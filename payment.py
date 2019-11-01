# This file is part of Tryton.  The COPYRIGHT file at the top level of
# this repository contains the full copyright notices and license terms.
import uuid
import logging
import urllib.parse
from decimal import Decimal
from email.header import Header
from itertools import groupby
from operator import attrgetter

import stripe

from trytond.cache import Cache
from trytond.config import config
from trytond.i18n import gettext
from trytond.model import (
    ModelSQL, ModelView, Workflow, DeactivableMixin, fields, dualmethod)
from trytond.pool import PoolMeta, Pool
from trytond.pyson import Eval, Bool
from trytond.report import Report, get_email
from trytond.rpc import RPC
from trytond.sendmail import sendmail_transactional
from trytond.transaction import Transaction
from trytond.url import HOSTNAME
from trytond.wizard import Wizard, StateAction

from trytond.modules.account_payment.exceptions import (
    ProcessError, PaymentValidationError)

__all__ = ['Journal', 'Group', 'Payment', 'Account', 'Customer',
    'Checkout', 'CheckoutPage']
logger = logging.getLogger(__name__)


class Journal(metaclass=PoolMeta):
    __name__ = 'account.payment.journal'

    stripe_account = fields.Many2One(
        'account.payment.stripe.account', "Account", ondelete='RESTRICT',
        states={
            'required': Eval('process_method') == 'stripe',
            'invisible': Eval('process_method') != 'stripe',
            },
        depends=['process_method'])

    @classmethod
    def __setup__(cls):
        super(Journal, cls).__setup__()
        stripe_method = ('stripe', 'Stripe')
        if stripe_method not in cls.process_method.selection:
            cls.process_method.selection.append(stripe_method)


class Group(metaclass=PoolMeta):
    __name__ = 'account.payment.group'

    def process_stripe(self):
        pool = Pool()
        Payment = pool.get('account.payment')
        for payment in self.payments:
            if not payment.stripe_token and not payment.stripe_customer:
                account = payment.journal.stripe_account
                for customer in payment.party.stripe_customers:
                    if (customer.stripe_account == account
                            and customer.stripe_customer_id):
                        payment.stripe_customer = customer
                        break
                else:
                    raise ProcessError(
                        gettext('account_payment_stripe.msg_no_stripe_token',
                            payment=payment.rec_name))
        Payment.save(self.payments)
        Payment.__queue__.stripe_charge(self.payments)


class CheckoutMixin:
    stripe_checkout_id = fields.Char("Stripe Checkout ID", readonly=True)

    @classmethod
    def copy(cls, records, default=None):
        if default is None:
            default = {}
        else:
            default = default.copy()
        default.setdefault('stripe_checkout_id')
        return super().copy(records, default=default)

    @classmethod
    @ModelView.button_action('account_payment_stripe.wizard_checkout')
    def stripe_checkout(cls, records):
        for record in records:
            record.stripe_checkout_id = uuid.uuid4().hex
        cls.save(records)

    @property
    def stripe_checkout_url(self):
        pool = Pool()
        database = Transaction().database.name
        Checkout = pool.get('account.payment.stripe.checkout', type='wizard')
        action = Checkout.checkout.get_action()
        return action['url'] % {
            'hostname': HOSTNAME,
            'database': database,
            'model': self.__class__.__name__,
            'id': self.stripe_checkout_id,
            }


class Payment(CheckoutMixin, metaclass=PoolMeta):
    __name__ = 'account.payment'

    stripe_journal = fields.Function(
        fields.Boolean("Stripe Journal"), 'on_change_with_stripe_journal')
    stripe_checkout_needed = fields.Function(
        fields.Boolean("Stripe Checkout Needed"),
        'on_change_with_stripe_checkout_needed')
    stripe_charge_id = fields.Char(
        "Stripe Charge ID", readonly=True,
        states={
            'invisible': ~Eval('stripe_journal') | ~Eval('stripe_charge_id'),
            },
        depends=['stripe_journal'])
    stripe_capture = fields.Boolean(
        "Stripe Capture",
        states={
            'invisible': ~Eval('stripe_journal'),
            'readonly': Eval('state') != 'draft',
            },
        depends=['stripe_journal', 'state'])
    stripe_captured = fields.Boolean(
        "Stripe Captured", readonly=True)
    stripe_capture_needed = fields.Function(
        fields.Boolean("Stripe Capture Needed"),
        'get_stripe_capture_needed')
    stripe_token = fields.Char(
        "Stripe Token", readonly=True,
        states={
            'invisible': ~Eval('stripe_token'),
            })
    stripe_payment_intent_id = fields.Char(
        "Stripe Payment Intent", readonly=True,
        states={
            'invisible': ~Eval('stripe_payment_intent_id'),
            })
    stripe_chargeable = fields.Boolean(
        "Stripe Chargeable",
        states={
            'invisible': ~Eval('stripe_journal') | ~Eval('stripe_token'),
            },
        depends=['stripe_journal', 'stripe_token'])
    stripe_capturable = fields.Boolean(
        "Stripe Capturable",
        states={
            'invisible': (~Eval('stripe_journal')
                | ~Eval('stripe_payment_intent_id')
                | ~Eval('stripe_capture_needed')),
            },
        depends=[
            'stripe_journal', 'stripe_payment_intent_id',
            'stripe_capture_needed'])
    stripe_idempotency_key = fields.Char(
        "Stripe Idempotency Key", readonly=True)
    stripe_error_message = fields.Char("Stripe Error Message", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_message'),
            })
    stripe_error_code = fields.Char("Stripe Error Code", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_code'),
            })
    stripe_error_param = fields.Char("Stripe Error Param", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_param'),
            })
    stripe_dispute_reason = fields.Char("Stripe Dispute Reason", readonly=True,
        states={
            'invisible': ~Eval('stripe_dispute_reason'),
            })
    stripe_dispute_status = fields.Char("Stripe Dispute Status", readonly=True,
        states={
            'invisible': ~Eval('stripe_dispute_status'),
            })
    stripe_customer = fields.Many2One(
        'account.payment.stripe.customer', "Stripe Customer",
        domain=[
            ('party', '=', Eval('party', -1)),
            ('stripe_account', '=', Eval('stripe_account', -1)),
            ],
        states={
            'invisible': ~Eval('stripe_journal'),
            'required': Bool(Eval('stripe_customer_source')),
            'readonly': (~Eval('state').in_(['draft', 'approved'])
                | Eval('stripe_token') | Eval('stripe_payment_intent_id')),
            },
        depends=['party', 'stripe_account', 'stripe_journal',
            'stripe_customer_source', 'stripe_token',
            'stripe_payment_intent_id', 'state'])
    stripe_customer_source = fields.Char(
        "Stripe Customer Source",
        states={
            'invisible': (~Eval('stripe_journal')
                | Eval('stripe_token')
                | Eval('stripe_payment_intent_id')
                | ~Eval('stripe_customer')),
            'readonly': ~Eval('state').in_(['draft', 'approved']),
            },
        depends=['stripe_journal', 'stripe_token', 'stripe_payment_intent_id',
            'stripe_customer', 'state'])
    # Use Function field with selection to avoid to query Stripe
    # to validate the value
    stripe_customer_source_selection = fields.Function(fields.Selection(
            'get_stripe_customer_sources', "Stripe Customer Source",
            states={
                'invisible': (~Eval('stripe_journal')
                    | Eval('stripe_token')
                    | Eval('stripe_payment_intent_id')
                    | ~Eval('stripe_customer')),
                'readonly': ~Eval('state').in_(['draft', 'approved']),
                },
            depends=[
                'stripe_journal', 'stripe_token', 'stripe_customer', 'state']),
        'get_stripe_customer_source', setter='set_stripe_customer_source')
    stripe_customer_payment_method = fields.Char(
        "Stripe Payment Method",
        states={
            'invisible': (~Eval('stripe_journal')
                | Eval('stripe_token')
                | ~Eval('stripe_customer')),
            'readonly': (~Eval('state').in_(['draft', 'approved'])
                | Eval('stripe_payment_intent_id')),
            },
        depends=['stripe_journal', 'stripe_token', 'stripe_customer', 'state'])
    # Use Function field with selection to avoid to query Stripe
    # to validate the value
    stripe_customer_payment_method_selection = fields.Function(
        fields.Selection(
            'get_stripe_customer_payment_methods',
            "Stripe Customer Payment Method",
            states={
                'invisible': (~Eval('stripe_journal')
                    | Eval('stripe_token')
                    | ~Eval('stripe_customer')),
                'readonly': (~Eval('state').in_(['draft', 'approved'])
                    | Eval('stripe_payment_intent_id')),
                },
            depends=[
                'stripe_journal', 'stripe_token', 'stripe_customer', 'state']),
        'get_stripe_customer_payment_method',
        setter='set_stripe_customer_payment_method')
    stripe_account = fields.Function(fields.Many2One(
            'account.payment.stripe.account', "Stripe Account"),
        'on_change_with_stripe_account')
    stripe_amount = fields.Function(
        fields.Integer("Stripe Amount"),
        'get_stripe_amount', setter='set_stripe_amount')

    @classmethod
    def __setup__(cls):
        super(Payment, cls).__setup__()
        cls.amount.states['readonly'] &= ~Eval('stripe_capture_needed')
        cls.amount.depends.append('stripe_capture_needed')
        cls.stripe_amount.states.update(cls.amount.states)
        cls.stripe_amount.depends.extend(cls.amount.depends)
        cls._buttons.update({
                'stripe_checkout': {
                    'invisible': (~Eval('state', 'draft').in_(
                            ['approved', 'processing'])
                        | ~Eval('stripe_checkout_needed', False)),
                    'depends': ['state', 'stripe_checkout_needed'],
                    },
                'stripe_do_capture': {
                    'invisible': ((Eval('state', 'draft') != 'processing')
                        | ~Eval('stripe_capture_needed')),
                    'depends': ['state', 'stripe_capture_needed'],
                    },
                })

    @classmethod
    def __register__(cls, module_name):
        cursor = Transaction().connection.cursor()
        sql_table = cls.__table__()
        table = cls.__table_handler__(module_name)
        idempotency_key_exist = table.column_exist('stripe_idempotency_key')

        super(Payment, cls).__register__(module_name)

        # Migration from 4.6: do not set the same key to all existing payments
        if not idempotency_key_exist:
            cursor.execute(*sql_table.update(
                    [sql_table.stripe_idempotency_key], [None]))

    @classmethod
    def default_stripe_capture(cls):
        return True

    @classmethod
    def default_stripe_captured(cls):
        return False

    @classmethod
    def default_stripe_chargeable(cls):
        return False

    @classmethod
    def default_stripe_capturable(cls):
        return False

    @classmethod
    def default_stripe_idempotency_key(cls):
        return uuid.uuid4().hex

    @fields.depends('journal')
    def on_change_with_stripe_journal(self, name=None):
        if self.journal:
            return self.journal.process_method == 'stripe'
        else:
            return False

    @fields.depends('party')
    def on_change_party(self):
        super(Payment, self).on_change_party()
        self.stripe_customer = None
        self.stripe_customer_source = None
        self.stripe_customer_source_selection = None

    @fields.depends('stripe_customer', 'stripe_customer_source')
    def get_stripe_customer_sources(self):
        sources = [('', '')]
        if self.stripe_customer:
            sources.extend(self.stripe_customer.sources())
        if (self.stripe_customer_source
                and self.stripe_customer_source not in dict(sources)):
            sources.append(
                (self.stripe_customer_source, self.stripe_customer_source))
        return sources

    @fields.depends(
        'stripe_customer_source_selection',
        'stripe_customer_source')
    def on_change_stripe_customer_source_selection(self):
        self.stripe_customer_source = self.stripe_customer_source_selection

    def get_stripe_customer_source(self, name):
        return self.stripe_customer_source

    @classmethod
    def set_stripe_customer_source(cls, payments, name, value):
        pass

    @fields.depends('stripe_customer', 'stripe_customer_payment_method')
    def get_stripe_customer_payment_methods(self):
        methods = [('', '')]
        if self.stripe_customer:
            methods.extend(self.stripe_customer.payment_methods())
        if (self.stripe_customer_payment_method
                and self.stripe_customer_payment_method not in dict(methods)):
            methods.append(
                (self.stripe_customer_payment_method,
                    self.stripe_customer_payment_method))
        return methods

    @fields.depends(
        'stripe_customer_payment_method_selection',
        'stripe_customer_payment_method')
    def on_change_stripe_customer_payment_method_selection(self):
        self.stripe_customer_payment_method = (
            self.stripe_customer_payment_method_selection)

    def get_stripe_customer_payment_method(self, name):
        return self.stripe_customer_payment_method

    @classmethod
    def set_stripe_customer_payment_method(cls, payments, name, value):
        pass

    @fields.depends('stripe_journal',
        'stripe_token', 'stripe_payment_intent_id',
        'stripe_customer_source', 'stripe_customer_source_selection',
        'stripe_customer_payment_method',
        'stripe_customer_payment_method_selection')
    def on_change_with_stripe_checkout_needed(self, name=None):
        return (self.stripe_journal
            and not self.stripe_token
            and not self.stripe_payment_intent_id
            and not self.stripe_customer_source
            and not self.stripe_customer_payment_method)

    def get_stripe_capture_needed(self, name):
        return (self.journal.process_method == 'stripe'
            and (self.stripe_charge_id
                or self.stripe_payment_intent_id)
            and not self.stripe_capture
            and not self.stripe_captured)

    @fields.depends('journal')
    def on_change_with_stripe_account(self, name=None):
        if self.journal and self.journal.process_method == 'stripe':
            return self.journal.stripe_account.id

    def get_stripe_amount(self, name):
        return int(self.amount * 10 ** self.currency_digits)

    @classmethod
    def set_stripe_amount(cls, payments, name, value):
        keyfunc = attrgetter('currency_digits')
        payments = sorted(payments, key=keyfunc)
        value = Decimal(value)
        for digits, payments in groupby(payments, keyfunc):
            digits = Decimal(digits)
            cls.write(list(payments), {
                    'amount': value * 10 ** -digits,
                    })

    @classmethod
    def view_attributes(cls):
        return super().view_attributes() + [
            ('//group[@id="stripe"]', 'states', {
                    'invisible': ~Eval('stripe_journal'),
                    }),
            ]

    @classmethod
    def validate(cls, payments):
        super(Payment, cls).validate(payments)
        for payment in payments:
            payment.check_stripe_journal()

    def check_stripe_journal(self):
        if (self.kind != 'receivable'
                and self.journal.process_method == 'stripe'):
            raise PaymentValidationError(
                gettext('account_payment_stripe.msg_stripe_receivable',
                    journal=self.journal.rec_name,
                    payment=self.rec_name))

    @classmethod
    def create(cls, vlist):
        vlist = [v.copy() for v in vlist]
        for values in vlist:
            # Ensure to get a different key for each record
            # default methods are called only once
            values.setdefault('stripe_idempotency_key',
                cls.default_stripe_idempotency_key())
        return super(Payment, cls).create(vlist)

    @classmethod
    def copy(cls, payments, default=None):
        if default is None:
            default = {}
        else:
            default = default.copy()
        default.setdefault('stripe_charge_id', None)
        default.setdefault('stripe_token', None)
        default.setdefault('stripe_payment_intent_id', None)
        default.setdefault('stripe_idempotency_key', None)
        default.setdefault('stripe_error_message', None)
        default.setdefault('stripe_error_code', None)
        default.setdefault('stripe_error_param', None)
        default.setdefault('stripe_captured', False)
        default.setdefault('stripe_chargeable', False)
        default.setdefault('stripe_capturable', False)
        return super(Payment, cls).copy(payments, default=default)

    @classmethod
    @ModelView.button
    @Workflow.transition('draft')
    def draft(cls, payments):
        super(Payment, cls).draft(payments)
        for payment in payments:
            if payment.stripe_token:
                payment.stripe_token = None
                payment.stripe_payment_intent_id = None
        cls.save(payments)

    @classmethod
    def stripe_checkout(cls, payments):
        for payment in payments:
            if not payment.stripe_payment_intent_id:
                payment_intent = stripe.PaymentIntent.create(
                    **payment._payment_intent_parameters(off_session=False))
                payment.stripe_payment_intent_id = payment_intent.id
        return super().stripe_checkout(payments)

    def _send_email_checkout(self, from_=None):
        pool = Pool()
        Language = pool.get('ir.lang')
        if from_ is None:
            from_ = config.get('email', 'from')
        self.stripe_checkout([self])
        emails = self._emails_checkout()
        if not emails:
            logger.warning("Could not send checkout email for %d", self.id)
            return
        languages = [self.party.lang or Language.get()]
        msg, title = get_email(
            'account.payment.stripe.email_checkout', self, languages)
        msg['From'] = from_
        msg['To'] = ','.join(emails)
        msg['Subject'] = Header(title, 'utf-8')
        sendmail_transactional(from_, emails, msg)

    def _emails_checkout(self):
        emails = []
        if self.party.email:
            emails.append(self.party.email)
        return emails

    def _payment_intent_parameters(self, off_session=False):
        idempotency_key = None
        if self.stripe_idempotency_key:
            idempotency_key = 'payment_intent-%s' % self.stripe_idempotency_key
        params = {
            'api_key': self.journal.stripe_account.secret_key,
            'amount': self.stripe_amount,
            'currency': self.currency.code,
            'capture_method': 'automatic' if self.stripe_capture else 'manual',
            'customer': (self.stripe_customer.stripe_customer_id
                if self.stripe_customer else None),
            'description': self.description,
            'off_session': off_session,
            'payment_method_types': ['card'],
            'idempotency_key': idempotency_key,
            }
        if self.stripe_customer_payment_method:
            params['payment_method'] = self.stripe_customer_payment_method
            params['confirm'] = True
        return params

    @classmethod
    def stripe_charge(cls, payments=None):
        """Charge stripe payments

        The transaction is committed after each payment charge.
        """
        if payments is None:
            payments = cls.search([
                    ('state', '=', 'processing'),
                    ('journal.process_method', '=', 'stripe'),
                    ['OR',
                        [
                            ('stripe_token', '!=', None),
                            ('stripe_chargeable', '=', True),
                            ],
                        ('stripe_customer_source', '!=', None),
                        ('stripe_customer_payment_method', '!=', None),
                        ],
                    ('stripe_charge_id', '=', None),
                    ('stripe_payment_intent_id', '=', None),
                    ('company', '=', Transaction().context.get('company')),
                    ])

        def create_charge(payment):
            charge = stripe.Charge.create(**payment._charge_parameters())
            payment.stripe_charge_id = charge.id
            payment.stripe_captured = charge.captured
            payment.save()

        def create_payment_intent(payment):
            try:
                payment_intent = stripe.PaymentIntent.create(
                    **payment._payment_intent_parameters(off_session=True))
            except stripe.error.CardError as e:
                error = e.json_body.get('error', {})
                payment_intent = error.get('payment_intent')
                if not payment_intent:
                    raise
            payment.stripe_payment_intent_id = payment_intent['id']
            payment.save()

        for payment in payments:
            # Use clear cache after a commit
            payment = cls(payment.id)
            if (payment.stripe_charge_id
                    or payment.stripe_payment_intent_id
                    or payment.journal.process_method != 'stripe'
                    or payment.state != 'processing'):
                continue
            payment.lock()
            try:
                if ((payment.stripe_token and payment.stripe_chargeable)
                        or payment.stripe_customer_source):
                    create_charge(payment)
                elif payment.stripe_customer_payment_method:
                    create_payment_intent(payment)
            except (stripe.error.RateLimitError,
                    stripe.error.APIConnectionError) as e:
                logger.warning(str(e))
                continue
            except stripe.error.StripeError as e:
                payment.stripe_error_message = str(e)
                if isinstance(e, stripe.error.CardError):
                    payment.stripe_error_code = e.code
                    payment.stripe_error_param = e.param
                payment.save()
                cls.fail([payment])
            except Exception:
                logger.error(
                    "Error when processing payment %d", payment.id,
                    exc_info=True)
                continue
            Transaction().commit()

    def _charge_parameters(self):
        source, customer = None, None
        if self.stripe_token:
            source = self.stripe_token
        elif self.stripe_customer_source:
            source = self.stripe_customer_source
        if self.stripe_customer:
            customer = self.stripe_customer.stripe_customer_id
        idempotency_key = None
        if self.stripe_idempotency_key:
            idempotency_key = 'charge-%s' % self.stripe_idempotency_key
        return {
            'api_key': self.journal.stripe_account.secret_key,
            'amount': self.stripe_amount,
            'currency': self.currency.code,
            'capture': bool(self.stripe_capture),
            'description': self.description,
            'customer': customer,
            'source': source,
            'idempotency_key': idempotency_key,
            }

    @classmethod
    @ModelView.button
    def stripe_do_capture(cls, payments):
        cls.write(payments, {
                'stripe_capture': True,
                })
        cls.__queue__.stripe_capture_(payments)

    @classmethod
    def stripe_capture_(cls, payments=None):
        """Capture stripe payments

        The transaction is committed after each payment capture.
        """
        if payments is None:
            payments = cls.search([
                    ('state', '=', 'processing'),
                    ('journal.process_method', '=', 'stripe'),
                    ['OR',
                        ('stripe_charge_id', '!=', None),
                        [
                            ('stripe_payment_intent_id', '!=', None),
                            ('stripe_capturable', '=', True),
                            ],
                        ],
                    ('stripe_captured', '=', False),
                    ('stripe_capture', '=', True),
                    ('company', '=', Transaction().context.get('company')),
                    ])

        def capture_charge(payment):
            charge = stripe.Charge.retrieve(
                payment.stripe_charge_id,
                api_key=payment.journal.stripe_account.secret_key)
            charge.capture(**payment._capture_parameters())
            payment.stripe_captured = charge.captured
            payment.save()

        def capture_intent(payment):
            params = payment._capture_parameters()
            params['amount_to_capture'] = params.pop('amount')
            stripe.PaymentIntent.capture(
                payment.stripe_payment_intent_id,
                api_key=payment.journal.stripe_account.secret_key,
                **params)
            payment.stripe_captured = True
            payment.save()

        for payment in payments:
            # Use clear cache after a commit
            payment = cls(payment.id)
            if (payment.journal.process_method != 'stripe'
                    or payment.stripe_captured
                    or payment.state != 'processing'):
                continue
            payment.lock()
            try:
                if payment.stripe_charge_id:
                    capture_charge(payment)
                elif payment.stripe_payment_intent_id:
                    capture_intent(payment)
            except (stripe.error.RateLimitError,
                    stripe.error.APIConnectionError) as e:
                logger.warning(str(e))
                continue
            except stripe.error.StripeError as e:
                payment.stripe_error_message = str(e)
                payment.save()
                cls.fail([payment])
            except Exception:
                logger.error(
                    "Error when capturing payment %d", payment.id,
                    exc_info=True)
                continue
            Transaction().commit()

    def _capture_parameters(self):
        idempotency_key = None
        if self.stripe_idempotency_key:
            idempotency_key = 'capture-%s' % self.stripe_idempotency_key
        return {
            'amount': self.stripe_amount,
            'idempotency_key': idempotency_key,
            }

    @property
    def stripe_payment_intent(self):
        if not self.stripe_payment_intent_id:
            return
        try:
            return stripe.PaymentIntent.retrieve(
                self.stripe_payment_intent_id,
                api_key=self.journal.stripe_account.secret_key)
        except (stripe.error.RateLimitError,
                stripe.error.APIConnectionError) as e:
            logger.warning(str(e))

    stripe_intent = stripe_payment_intent

    @dualmethod
    def stripe_intent_update(cls, payments=None):
        pass


class Account(ModelSQL, ModelView):
    "Stripe Account"
    __name__ = 'account.payment.stripe.account'

    name = fields.Char("Name", required=True)
    secret_key = fields.Char("Secret Key", required=True)
    publishable_key = fields.Char("Publishable Key", required=True)
    webhook_identifier = fields.Char("Webhook Identifier", readonly=True)
    webhook_endpoint = fields.Function(
        fields.Char(
            "Webhook Endpoint",
            help="The URL to be called by Stripe."),
        'on_change_with_webhook_endpoint')
    webhook_signing_secret = fields.Char(
        "Webhook Signing Secret",
        states={
            'invisible': ~Eval('webhook_identifier'),
            },
        depends=['webhook_identifier'],
        help="The Stripe's signing secret of the webhook.")
    zip_code = fields.Boolean("Zip Code", help="Verification on checkout")
    last_event = fields.Char("Last Event", readonly=True)

    @classmethod
    def __setup__(cls):
        super(Account, cls).__setup__()
        cls._buttons.update({
                'new_identifier': {
                    'icon': 'tryton-refresh',
                    },
                })
        if Pool().test:
            cls.__rpc__['webhook'] = RPC(readonly=False, instantiate=0)

    @classmethod
    def default_zip_code(cls):
        return True

    @fields.depends('webhook_identifier')
    def on_change_with_webhook_endpoint(self, name=None):
        if not self.webhook_identifier:
            return ''
        # TODO add basic authentication support
        url_part = {
            'identifier': self.webhook_identifier,
            'database_name': Transaction().database.name,
            }
        return 'https://' + HOSTNAME + (
            urllib.parse.quote(
                '/%(database_name)s/account_payment_stripe'
                '/webhook/%(identifier)s'
                % url_part))

    @classmethod
    def fetch_events(cls):
        """Fetch last events of each account without webhook and process them

        The transaction is committed after each event.
        """
        accounts = cls.search([
                ('webhook_identifier', '=', None),
                ])
        for account in accounts:
            events = stripe.Event.list(
                api_key=account.secret_key,
                ending_before=account.last_event,
                limit=100)
            for event in reversed(list(events)):
                account.webhook(event)
                account.last_event = event.id
                account.save()
                Transaction().commit()

    def webhook(self, payload):
        """This method handles stripe webhook callbacks

        The return values are:
            - None if the method could not handle payload['type']
            - True if the payload has been handled
            - False if the webhook should be retried by Stripe
        """
        data = payload['data']
        type_ = payload['type']
        if type_ == 'charge.succeeded':
            return self.webhook_charge_succeeded(data)
        if type_ == 'charge.captured':
            return self.webhook_charge_captured(data)
        elif type_ == 'charge.expired':
            return self.webhook_charge_expired(data)
        elif type_ == 'charge.failed':
            return self.webhook_charge_failed(data)
        elif type_ == 'charge.pending':
            return self.webhook_charge_pending(data)
        elif type_ == 'charge.refunded':
            return self.webhook_charge_refunded(data)
        elif type_ == 'charge.dispute.created':
            return self.webhook_charge_dispute_created(data)
        elif type_ == 'charge.dispute.closed':
            return self.webhook_charge_dispute_closed(data)
        elif type_ == 'source.chargeable':
            return self.webhook_source_chargeable(data)
        elif type_ == 'source.failed':
            return self.webhook_source_failed(data)
        elif type_ == 'source.canceled':
            return self.webhook_source_canceled(data)
        elif type_ == 'payment_intent.succeeded':
            return self.webhook_payment_intent_succeeded(data)
        elif type_ == 'payment_intent.amount_capturable_updated':
            return self.webhook_payment_intent_amount_capturable_updated(data)
        elif type_ == 'payment_intent.payment_failed':
            return self.webhook_payment_intent_payment_failed(data)
        return None

    def webhook_charge_succeeded(self, payload, _event='charge.succeeded'):
        pool = Pool()
        Payment = pool.get('account.payment')

        charge = payload['object']
        payments = Payment.search([
                ('stripe_charge_id', '=', charge['id']),
                ])
        if not payments:
            payment_intent_id = charge.get('payment_intent')
            if payment_intent_id:
                found = Payment.search([
                        ('stripe_payment_intent_id', '=', payment_intent_id),
                        ])
                # Once payment intent has succeeded or failed,
                # only charge events are sent.
                payments = [p for p in found
                    if p.state in {'succeeded', 'failed'}]
                if found and not payments:
                    return True
            if not payments:
                logger.error("%s: No payment '%s'", _event, charge['id'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                if payment.state == 'succeeded':
                    Payment.fail([payment])
                payment.stripe_captured = charge['captured']
                payment.stripe_amount = (
                    charge['amount'] - charge['amount_refunded'])
                payment.save()
                if payment.amount:
                    if charge['status'] == 'succeeded' and charge['captured']:
                        Payment.succeed([payment])
                else:
                    Payment.fail([payment])
        return bool(payments)

    def webhook_charge_captured(self, payload):
        return self.webhook_charge_succeeded(payload, _event='charge.captured')

    def webhook_charge_expired(self, payload):
        return self.webhook_source_failed(payload)

    def webhook_charge_pending(self, payload):
        return self.webhook_charge_succeeded(payload, _event='charge.pending')

    def webhook_charge_refunded(self, payload):
        return self.webhook_charge_succeeded(payload, _event='charge.pending')

    def webhook_charge_failed(self, payload, _event='charge.failed'):
        pool = Pool()
        Payment = pool.get('account.payment')

        charge = payload['object']
        payments = Payment.search([
                ('stripe_charge_id', '=', charge['id']),
                ])
        if not payments:
            payment_intent_id = charge.get('payment_intent')
            if payment_intent_id:
                found = Payment.search([
                        ('stripe_payment_intent_id', '=', payment_intent_id),
                        ])
                # Once payment intent has succeeded or failed,
                # only charge events are sent.
                payments = [p for p in found
                    if p.state in {'succeeded', 'failed'}]
                if found and not payments:
                    return True
            if not payments:
                logger.error("%s: No payment '%s'", _event, charge['id'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                payment.stripe_error_message = charge['failure_message']
                payment.stripe_error_code = charge['failure_code']
                payment.stripe_error_param = None
                payment.save()
                if charge['status'] == 'failed':
                    Payment.fail([payment])
        return bool(payments)

    def webhook_charge_dispute_created(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        source = payload['object']
        payments = Payment.search([
                ('stripe_charge_id', '=', source['charge']),
                ])
        if not payments:
            charge = stripe.Charge.retrieve(source['charge'],
                api_key=self.secret_key)
            if charge.payment_intent:
                payments = Payment.search([
                        ('stripe_payment_intent_id', '=',
                            charge.payment_intent),
                        ])
        if not payments:
            logger.error(
                "charge.dispute.created: No payment '%s'", source['charge'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                payment.stripe_dispute_reason = source['reason']
                payment.stripe_dispute_status = source['status']
                payment.save()
        return bool(payments)

    def webhook_charge_dispute_closed(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        source = payload['object']
        payments = Payment.search([
                ('stripe_charge_id', '=', source['charge']),
                ])
        if not payments:
            charge = stripe.Charge.retrieve(source['charge'],
                api_key=self.secret_key)
            if charge.payment_intent:
                payments = Payment.search([
                        ('stripe_payment_intent_id', '=',
                            charge.payment_intent),
                        ])
        if not payments:
            logger.error(
                "charge.dispute.closed: No payment '%s'", source['charge'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                payment.stripe_dispute_reason = source['reason']
                payment.stripe_dispute_status = source['status']
                payment.save()
                if source['status'] == 'lost':
                    Payment.fail([payment])
                    if payment.stripe_amount != source['amount']:
                        payment.stripe_amount -= source['amount']
                        payment.save()
                        Payment.succeed([payment])
        return bool(payments)

    def webhook_source_chargeable(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        source = payload['object']
        payments = Payment.search([
                ('stripe_token', '=', source['id']),
                ])
        if payments:
            Payment.write(payments, {'stripe_chargeable': True})
        return True

    def webhook_source_failed(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        source = payload['object']
        payments = Payment.search([
                ('stripe_token', '=', source['id']),
                ])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                Payment.fail([payment])
        return True

    def webhook_source_canceled(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        source = payload['object']
        payments = Payment.search([
                ('stripe_token', '=', source['id']),
                ])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                Payment.fail([payment])
        return True

    def webhook_payment_intent_succeeded(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        payment_intent = payload['object']
        payments = Payment.search([
                ('stripe_payment_intent_id', '=', payment_intent['id']),
                ])
        if not payments:
            logger.error(
                "payment_intent.succeeded: No payment '%s'",
                payment_intent['id'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                if payment.state == 'succeeded':
                    Payment.fail([payment])
                payment.stripe_captured = bool(
                    payment_intent['amount_received'])
                payment.stripe_amount = payment_intent['amount_received']
                payment.save()
                if payment.amount:
                    Payment.succeed([payment])
                else:
                    Payment.fail([payment])
        return bool(payments)

    def webhook_payment_intent_amount_capturable_updated(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        payment_intent = payload['object']
        payments = Payment.search([
                ('stripe_payment_intent_id', '=', payment_intent['id']),
                ])
        if not payments:
            logger.error(
                "payment_intent.succeeded: No payment '%s'",
                payment_intent['id'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                if payment.state == 'succeeded':
                    Payment.fail([payment])
                payment.stripe_capturable = bool(
                    payment_intent['amount_capturable'])
                if payment.stripe_amount > payment_intent['amount_capturable']:
                    payment.stripe_amount = payment_intent['amount_capturable']
                payment.save()
        return bool(payments)

    def webhook_payment_intent_payment_failed(self, payload):
        pool = Pool()
        Payment = pool.get('account.payment')

        payment_intent = payload['object']
        payments = Payment.search([
                ('stripe_payment_intent_id', '=', payment_intent['id']),
                ])
        if not payments:
            logger.error(
                "payment_intent.succeeded: No payment '%s'",
                payment_intent['id'])
        for payment in payments:
            # TODO: remove when https://bugs.tryton.org/issue4080
            with Transaction().set_context(company=payment.company.id):
                payment = Payment(payment.id)
                error = payment_intent['last_payment_error']
                if error:
                    payment.stripe_error_message = error['message']
                    payment.stripe_error_code = error['code']
                    payment.stripe_error_param = None
                    payment.save()
                if payment_intent['status'] in [
                        'requires_payment_method', 'requires_source']:
                    payment._send_email_checkout()
                else:
                    Payment.fail([payment])
        return bool(payments)

    @classmethod
    @ModelView.button
    def new_identifier(cls, accounts):
        for account in accounts:
            if account.webhook_identifier:
                account.webhook_identifier = None
            else:
                account.webhook_identifier = uuid.uuid4().hex
        cls.save(accounts)


class Customer(CheckoutMixin, DeactivableMixin, ModelSQL, ModelView):
    "Stripe Customer"
    __name__ = 'account.payment.stripe.customer'
    _history = True
    party = fields.Many2One('party.party', "Party", required=True, select=True,
        states={
            'readonly': Eval('stripe_customer_id') | Eval('stripe_token'),
            },
        depends=['stripe_customer_id', 'stripe_token'])
    stripe_account = fields.Many2One(
        'account.payment.stripe.account', "Account", required=True,
        states={
            'readonly': Eval('stripe_customer_id') | Eval('stripe_token'),
            },
        depends=['stripe_customer_id', 'stripe_token'])
    stripe_checkout_needed = fields.Function(
        fields.Boolean("Stripe Checkout Needed"), 'get_stripe_checkout_needed')
    stripe_customer_id = fields.Char(
        "Stripe Customer ID",
        states={
            'readonly': ((Eval('stripe_customer_id') | Eval('stripe_token'))
                & (Eval('id', -1) >= 0)),
            },
        depends=['stripe_token'])
    stripe_token = fields.Char("Stripe Token", readonly=True)
    stripe_setup_intent_id = fields.Char(
        "Stripe SetupIntent ID", readonly=True)
    stripe_error_message = fields.Char("Stripe Error Message", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_message'),
            })
    stripe_error_code = fields.Char("Stripe Error Code", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_code'),
            })
    stripe_error_param = fields.Char("Stripe Error Param", readonly=True,
        states={
            'invisible': ~Eval('stripe_error_param'),
            })

    _sources_cache = Cache(
        'account_payment_stripe_customer.sources',
        duration=config.getint(
            'account_payment_stripe', 'sources_cache', default=15 * 60))
    _payment_methods_cache = Cache(
        'account_payment_stripe_customer.payment_methods',
        duration=config.getint(
            'account_payment_stripe', 'payment_methods', default=15 * 60))

    @classmethod
    def __setup__(cls):
        super(Customer, cls).__setup__()
        cls._buttons.update({
                'stripe_checkout': {
                    'invisible': ~Eval('stripe_checkout_needed', False),
                    'depends': ['stripe_checkout_needed'],
                    },
                })

    def get_stripe_checkout_needed(self, name):
        return (not self.stripe_customer_id
            or not self.stripe_token
            or not self.stripe_setup_intent_id)

    def get_rec_name(self, name):
        name = super(Customer, self).get_rec_name(name)
        return self.stripe_customer_id if self.stripe_customer_id else name

    @classmethod
    def write(cls, *args, **kwargs):
        super().write(*args, **kwargs)
        cls._sources_cache.clear()
        cls._payment_methods_cache.clear()

    @classmethod
    def delete(cls, customers):
        cls.write(customers, {
                'active': False,
                })

    @classmethod
    def copy(cls, customers, default=None):
        if default is None:
            default = {}
        else:
            default = default.copy()
        default.setdefault('stripe_token', None)
        default.setdefault('stripe_customer_id', None)
        return super(Customer, cls).copy(customers, default=default)

    @classmethod
    def stripe_checkout(cls, customers):
        for customer in customers:
            if customer.stripe_setup_intent_id:
                continue
            setup_intent = stripe.SetupIntent.create(
                api_key=customer.stripe_account.secret_key)
            customer.stripe_setup_intent_id = setup_intent.id
        return super().stripe_checkout(customers)

    @classmethod
    def stripe_create(cls, customers=None):
        """Create stripe customer with token

        The transaction is committed after each customer.
        """
        if not customers:
            customers = cls.search([
                    ('stripe_token', '!=', None),
                    ['OR',
                        ('stripe_customer_id', '=', None),
                        ('stripe_customer_id', '=', ''),
                        ],
                    ])
        for customer in customers:
            # Use clear cache after a commit
            customer = cls(customer.id)
            if customer.stripe_customer_id:
                continue
            customer.lock()
            try:
                cu = stripe.Customer.create(
                    api_key=customer.stripe_account.secret_key,
                    description=customer.rec_name,
                    email=customer.party.email,
                    source=customer.stripe_token)
            except stripe.error.RateLimitError:
                logger.warning("Rate limit error")
                continue
            except stripe.error.StripeError as e:
                customer.stripe_error_message = str(e)
                if isinstance(e, stripe.error.CardError):
                    customer.stripe_error_code = e.code
                    customer.stripe_error_param = e.param
                customer.stripe_token = None
            except Exception:
                logger.error(
                    "Error when creating customer %d", customer.id,
                    exc_info=True)
                continue
            else:
                customer.stripe_customer_id = cu.id
                # TODO add card
            customer.save()
            Transaction().commit()

    @classmethod
    def stripe_delete(cls, customers=None):
        """Delete customer

        The transaction is committed after each customer.
        """
        if not customers:
            customers = cls.search([
                    ('active', '=', False),
                    ('stripe_customer_id', '!=', None),
                    ])
        for customer in customers:
            # Use clear cache after a commit
            customer = cls(customer.id)
            assert not customer.active
            customer.lock()
            try:
                cu = stripe.Customer.retrieve(
                    api_key=customer.stripe_account.secret_key,
                    id=customer.stripe_customer_id)
                cu.delete()
            except stripe.error.RateLimitError:
                logger.warning("Rate limit error")
                continue
            except Exception:
                logger.error(
                    "Error when deleting customer %d", customer.id,
                    exc_info=True)
                continue
            customer.stripe_token = None
            customer.stripe_customer_id = None
            customer.save()
            Transaction().commit()

    def retrieve(self):
        if not self.stripe_customer_id:
            return
        try:
            return stripe.Customer.retrieve(
                api_key=self.stripe_account.secret_key,
                id=self.stripe_customer_id)
        except (stripe.error.RateLimitError,
                stripe.error.APIConnectionError) as e:
            logger.warning(str(e))

    def sources(self):
        sources = self._sources_cache.get(self.id)
        if sources is not None:
            return sources
        sources = []
        customer = self.retrieve()
        if customer:
            for source in customer.sources:
                name = source.id
                if source.object == 'card':
                    name = self._source_name(source)
                elif source.object == 'source':
                    if source.usage != 'reusable':
                        continue
                    name = self._source_name(source)
                else:
                    continue
                sources.append((source.id, name))
            self._sources_cache.set(self.id, sources)
        return sources

    def _source_name(cls, source):
        def card_name(card):
            name = card.brand
            if card.last4 or card.dynamic_last4:
                name += ' ****' + (card.last4 or card.dynamic_last4)
            if card.exp_month and card.exp_year:
                name += ' %s/%s' % (card.exp_month, card.exp_year)
            return name

        name = source.id
        if source.object == 'card':
            name = card_name(source)
        elif source.object == 'source':
            if source.type == 'card':
                name = card_name(source.card)
            elif source.type == 'sepa_debit':
                name = '****' + source.sepa_debit.last4
        return name

    def payment_methods(self):
        methods = self._payment_methods_cache.get(self.id)
        if methods is not None:
            return methods
        methods = []
        if self.stripe_customer_id:
            try:
                payment_methods = stripe.PaymentMethod.list(
                    api_key=self.stripe_account.secret_key,
                    customer=self.stripe_customer_id,
                    type='card')
            except (stripe.error.RateLimitError,
                    stripe.error.APIConnectionError) as e:
                logger.warning(str(e))
                return []
            for payment_method in payment_methods:
                name = self._payment_method_name(payment_method)
                methods.append((payment_method.id, name))
        self._payment_methods_cache.set(self.id, methods)
        return methods

    def _payment_method_name(cls, payment_method):
        name = payment_method.id
        if payment_method.type == 'card':
            card = payment_method.card
            name = card.brand
            if card.last4:
                name += ' ****' + card.last4
            if card.exp_month and card.exp_year:
                name += ' %s/%s' % (card.exp_month, card.exp_year)
        return name

    @property
    def stripe_setup_intent(self):
        if not self.stripe_setup_intent_id:
            return
        try:
            return stripe.SetupIntent.retrieve(
                self.stripe_setup_intent_id,
                api_key=self.stripe_account.secret_key)
        except (stripe.error.RateLimitError,
                stripe.error.APIConnectionError) as e:
            logger.warning(str(e))

    stripe_intent = stripe_setup_intent

    @dualmethod
    def stripe_intent_update(cls, customers=None):
        """Update stripe customers with intent

        The transaction is committed after each customer."""
        if customers is None:
            customers = cls.search([
                    ('stripe_setup_intent_id', '!=', None),
                    ])

        for customer in customers:
            # Use clear cache after commit
            customer = cls(customer.id)
            setup_intent = customer.stripe_setup_intent
            if not setup_intent or setup_intent.status != 'succeeded':
                continue
            customer.lock()
            try:
                if customer.stripe_customer_id:
                    stripe.PaymentMethod.attach(
                        setup_intent.payment_method,
                        customer=customer.stripe_customer_id,
                        api_key=customer.stripe_account.secret_key)
                else:
                    cu = stripe.Customer.create(
                        api_key=customer.stripe_account.secret_key,
                        description=customer.rec_name,
                        email=customer.party.email,
                        payment_method=setup_intent.payment_method)
                    customer.stripe_customer_id = cu.id
            except stripe.error.RateLimitError:
                logger.warning("Rate limit error")
                continue
            except stripe.error.StripeError as e:
                customer.stripe_error_message = str(e)
            except Exception:
                logger.error(
                    "Error when updating customer %d", customer.id,
                    exc_info=True)
                continue
            else:
                customer.stripe_error_message = None
                customer.stripe_error_code = None
                customer.stripe_error_param = None
            customer.stripe_setup_intent_id = None
            customer.save()
            cls._payment_methods_cache.clear()
            Transaction().commit()


class Checkout(Wizard):
    "Stripe Checkout"
    __name__ = 'account.payment.stripe.checkout'
    start_state = 'checkout'
    checkout = StateAction('account_payment_stripe.url_checkout')

    def do_checkout(self, action):
        pool = Pool()
        Payment = pool.get('account.payment')
        Customer = pool.get('account.payment.stripe.customer')
        context = Transaction().context
        active_model = context['active_model']
        active_id = context['active_id']
        if active_model == Payment.__name__:
            Model = Payment
        elif active_model == Customer.__name__:
            Model = Customer
        else:
            raise ValueError("Invalid active_model: %s" % active_model)
        record = Model(active_id)
        action['url'] = record.stripe_checkout_url
        return action, {}


class CheckoutPage(Report):
    "Stripe Checkout"
    __name__ = 'account.payment.stripe.checkout'
