"Tree"
import gtk
from gtk import glade
import gettext
import tryton.common as common
from view_tree import ViewTree, ViewTreeSC
import tryton.rpc as rpc
from tryton.config import CONFIG
#import win_export
from tryton.config import GLADE
from window import Window
from tryton.action import Action

_ = gettext.gettext

class Tree(object):
    "Tree page"

    def __init__(self, model, res_id=False, view_id=False, domain=None, context=None,
            window=None, name=False):
        if domain is None:
            domain = {}
        if context is None:
            context = {}
        if view_id:
            view_base =  rpc.session.rpc_exec_auth('/object', 'execute',
                    'ir.ui.view', 'read', view_id,
                    ['model', 'type'], context)
            view = rpc.session.rpc_exec_auth('/object', 'execute',
                    view_base['model'], 'fields_view_get', view_id,
                    view_base['type'],context)
        else:
            view = rpc.session.rpc_exec_auth('/object', 'execute', model,
                    'fields_view_get', False, view_type, context)

        self.glade = glade.XML(GLADE, 'win_tree_container',
                gettext.textdomain())
        self.widget = self.glade.get_widget('win_tree_container')
        self.widget.show_all()
        self.model = view['model'] or model
        self.domain2 = domain
        if view.get('field_parent', False):
            self.domain = []
        else:
            self.domain = domain
        self.view = view
        self.window = window

        self.context = context

        self.tree_res = ViewTree(view, [], True,
                context=context)
        self.tree_res.view.connect('row-activated', self.sig_activate)

        if not name:
            self.name = self.tree_res.name
        else:
            self.name = name
        self.scrollwindow = self.glade.get_widget('main_tree_sw')

        wid = self.glade.get_widget('widget_vbox')
        if CONFIG['client.modepda'] and not self.tree_res.toolbar:
            wid.hide()
        else:
            wid.show()

        widget_sc = self.glade.get_widget('win_tree_sc')

        widget_sc.connect('row-activated', self.sc_go)
        self.tree_sc = ViewTreeSC(widget_sc, self.model)
        self.handlers = {
            'but_reload': self.sig_reload,
            'but_switch': self.sig_edit,
            'but_open': self.sig_open,
            'but_action': self.sig_action,
            'but_print': self.sig_print,
            'but_save_as': self.sig_save_as,
        }
        signals = {
            'on_but_sc_go_clicked': self.sc_go,
            'on_but_sc_add_clicked': self.sc_add,
            'on_but_sc_del_clicked': self.sc_del,
        }

        self.scrollwindow.add(self.tree_res.widget_get())
        self.sig_reload()

        for signal in signals:
            self.glade.signal_connect(signal, signals[signal])

    def sig_reload(self, widget=None):
        ids = rpc.session.rpc_exec_auth('/object', 'execute', self.model,
                'search', self.domain2)
        if self.tree_res.toolbar:

            icon_name = 'icon'
            wid = self.glade.get_widget('tree_toolbar')
            for child in wid.get_children():
                wid.remove(child)
            ctx = {}
            ctx.update(rpc.session.context)
            results = rpc.session.rpc_exec_auth_try('/object', 'execute',
                    self.view['model'], 'read', ids, ['name', icon_name], ctx)
            radiotb = None
            for res in results:
                radiotb = gtk.RadioToolButton(group=radiotb)
                radiotb.set_label_widget(gtk.Label(res['name']))

                icon = gtk.Image()
                if hasattr(res[icon_name], 'startswith') \
                        and res[icon_name].startswith('STOCK_'):
                    icon.set_from_stock(getattr(gtk, res[icon_name]),
                            gtk.ICON_SIZE_BUTTON)
                else:
                    try:
                        icon.set_from_stock(res[icon_name],
                                gtk.ICON_SIZE_BUTTON)
                    except:
                        pass

                hbox = gtk.HBox(spacing=6)
                hbox.pack_start(icon)
                hbox.pack_start(gtk.Label(res['name']))
                radiotb.set_icon_widget(hbox)
                radiotb.show_all()
                radiotb.set_data('id', res['id'])
                radiotb.connect('clicked', self.menu_main_clicked)
                self.menu_main_clicked(radiotb)
                wid.insert(radiotb, -1)
        else:
            self.tree_res.ids = ids
            self.tree_res.reload()
            wid = self.glade.get_widget('tree_toolbar')
            wid.hide()
            wid = self.glade.get_widget('tree_vpaned')
            wid.set_position(-1)

    def menu_main_clicked(self, widget):
        if widget.get_active():
            obj_id = widget.get_data('id')

            ids = rpc.session.rpc_exec_auth('/object', 'execute', self.model,
                    'read', obj_id, [self.view['field_parent']])\
                            [self.view['field_parent']]

            self.tree_res.ids = ids
            self.tree_res.reload()
        return False

    def sig_print(self, widget=None, keyword='client_print_multi'):
        self.sig_action(keyword='client_print_multi')

    def sig_action(self, widget=None, keyword='tree_but_action', obj_id=None,
            report_type='pdf'):
        ids = self.ids_get()

        if not obj_id and ids and len(ids):
            obj_id = ids[0]
        if obj_id:
            ctx = self.context.copy()
            if 'active_ids' in ctx:
                del ctx['active_ids']
            if 'active_id' in ctx:
                del ctx['active_id']
            Action.exec_keyword(keyword, {
                'model': self.model,
                'id': obj_id,
                'ids':ids,
                'report_type': report_type,
                'window': self.window,
                }, context=ctx)
        else:
            common.message(_('No resource selected!'), self.window)

    def sig_activate(self, tree_view, path, view_column):
        self.sig_action(tree_view, 'tree_but_open' )

    def sig_open(self, widget=None, event=None):
        self.sig_action(widget, 'tree_but_open' )

    def sig_remove(self, widget=None):
        ids = self.ids_get()
        if len(ids):
            if common.sur(_('Are you sure you want\nto remove this record?'),
                    self.window):
                rpc.session.rpc_exec_auth('/object', 'execute', self.model,
                        'unlink', ids)
                self.sig_reload()

    def sig_edit(self, widget=None):
        obj_id = False
        ids = self.ids_get()
        if ids:
            obj_id = ids[0]
        elif self.tree_res.toolbar:
            wid = self.glade.get_widget('tree_toolbar')
            for child in wid.get_children():
                if child.get_active():
                    obj_id = child.get_data('id')
        if obj_id:
            Window.create(None, self.model, obj_id, self.domain,
                    window=self.window, mode=['form', 'tree'])
        else:
            common.message(_('No resource selected!'))

    def sc_del(self, widget):
        obj_id = self.tree_sc.sel_id_get()
        if obj_id != None:
            sc_id = int(self.tree_sc.value_get(2))
            rpc.session.rpc_exec_auth('/object', 'execute', 'ir.ui.view_sc',
                    'unlink', [sc_id])
        self.tree_sc.update()

    def sc_add(self, widget):
        ids = self.tree_res.sel_ids_get()
        if len(ids):
            res = rpc.session.rpc_exec_auth('/object', 'execute', self.model,
                    'name_get', ids, rpc.session.context)
            for (obj_id, name) in res:
                user = rpc.session.user
                rpc.session.rpc_exec_auth('/object', 'execute',
                        'ir.ui.view_sc', 'create', {
                            'resource': self.model,
                            'user_id': user,
                            'res_id': obj_id,
                            'name': name,
                            })
        self.tree_sc.update()

    def sc_go(self, widget=None, *args):
        obj_id = self.tree_sc.sel_id_get()
        if obj_id != None:
            self.sig_action(None, 'tree_but_open', obj_id)

    def ids_get(self):
        res = self.tree_res.sel_ids_get()
        return res

    def sig_save_as(self, widget=None):
        win = win_export.win_export(self.model, self.tree_res.sel_ids_get(),
                self.tree_res.fields, [], parent=self.window)
        win.go()
