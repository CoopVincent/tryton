# This file is part of Tryton.  The COPYRIGHT file at the top level of
# this repository contains the full copyright notices and license terms.
import unittest
import trytond.tests.test_tryton
from trytond.tests.test_tryton import (test_view, test_depends,
    test_menu_action, POOL, DB_NAME, USER, CONTEXT)
from trytond.transaction import Transaction


class BankTestCase(unittest.TestCase):
    'Test Bank module'

    def setUp(self):
        trytond.tests.test_tryton.install_module('bank')
        self.bank = POOL.get('bank')
        self.party = POOL.get('party.party')
        self.account = POOL.get('bank.account')
        self.number = POOL.get('bank.account.number')

    def test0005views(self):
        'Test views'
        test_view('bank')

    def test0006depends(self):
        'Test depends'
        test_depends()

    def test0007menu_actions(self):
        'Test menu actions'
        test_menu_action('bank')

    def test0010iban_format(self):
        'Test IBAN format'
        with Transaction().start(DB_NAME, USER, context=CONTEXT):
            party = self.party(name='Test')
            party.save()
            bank = self.bank(party=party)
            bank.save()
            account, = self.account.create([{
                        'bank': bank.id,
                        'numbers': [('create', [{
                                        'type': 'iban',
                                        'number': 'BE82068896274468',
                                        }, {
                                        'type': 'other',
                                        'number': 'not IBAN',
                                        }])],
                        }])

            iban_number, other_number = account.numbers
            self.assertEqual(iban_number.type, 'iban')
            self.assertEqual(other_number.type, 'other')

            # Test format on create
            self.assertEqual(iban_number.number, 'BE82 0688 9627 4468')
            self.assertEqual(other_number.number, 'not IBAN')

            # Test format on write
            iban_number.number = 'BE82068896274468'
            iban_number.type = 'iban'
            iban_number.save()
            self.assertEqual(iban_number.number, 'BE82 0688 9627 4468')

            other_number.number = 'still not IBAN'
            other_number.save()
            self.assertEqual(other_number.number, 'still not IBAN')

            self.number.write([iban_number, other_number], {
                    'number': 'BE82068896274468',
                    })
            self.assertEqual(iban_number.number, 'BE82 0688 9627 4468')
            self.assertEqual(other_number.number, 'BE82068896274468')


def suite():
    suite = trytond.tests.test_tryton.suite()
    suite.addTests(unittest.TestLoader().loadTestsFromTestCase(
            BankTestCase))
    return suite
