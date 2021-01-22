/* This file is part of Tryton.  The COPYRIGHT file at the top level of
   this repository contains the full copyright notices and license terms. */
(function() {
    'use strict';

    var ENCODINGS = ["866", "ansi_x3.4-1968", "arabic", "ascii",
        "asmo-708", "big5", "big5-hkscs", "chinese", "cn-big5", "cp1250",
        "cp1251", "cp1252", "cp1253", "cp1254", "cp1255", "cp1256",
        "cp1257", "cp1258", "cp819", "cp866", "csbig5", "cseuckr",
        "cseucpkdfmtjapanese", "csgb2312", "csibm866", "csiso2022jp",
        "csiso2022kr", "csiso58gb231280", "csiso88596e", "csiso88596i",
        "csiso88598e", "csiso88598i", "csisolatin1", "csisolatin2",
        "csisolatin3", "csisolatin4", "csisolatin5", "csisolatin6",
        "csisolatin9", "csisolatinarabic", "csisolatincyrillic",
        "csisolatingreek", "csisolatinhebrew", "cskoi8r", "csksc56011987",
        "csmacintosh", "csshiftjis", "cyrillic", "dos-874", "ecma-114",
        "ecma-118", "elot_928", "euc-jp", "euc-kr", "gb18030", "gb2312",
        "gb_2312", "gb_2312-80", "gbk", "greek", "greek8", "hebrew",
        "hz-gb-2312", "ibm819", "ibm866", "iso-2022-cn", "iso-2022-cn-ext",
        "iso-2022-jp", "iso-2022-kr", "iso-8859-1", "iso-8859-10",
        "iso-8859-11", "iso-8859-13", "iso-8859-14", "iso-8859-15",
        "iso-8859-16", "iso-8859-2", "iso-8859-3", "iso-8859-4",
        "iso-8859-5", "iso-8859-6", "iso-8859-6-e", "iso-8859-6-i",
        "iso-8859-7", "iso-8859-8", "iso-8859-8-e", "iso-8859-8-i",
        "iso-8859-9", "iso-ir-100", "iso-ir-101", "iso-ir-109",
        "iso-ir-110", "iso-ir-126", "iso-ir-127", "iso-ir-138",
        "iso-ir-144", "iso-ir-148", "iso-ir-149", "iso-ir-157", "iso-ir-58",
        "iso8859-1", "iso8859-10", "iso8859-11", "iso8859-13", "iso8859-14",
        "iso8859-15", "iso8859-2", "iso8859-3", "iso8859-4", "iso8859-5",
        "iso8859-6", "iso8859-7", "iso8859-8", "iso8859-9", "iso88591",
        "iso885910", "iso885911", "iso885913", "iso885914", "iso885915",
        "iso88592", "iso88593", "iso88594", "iso88595", "iso88596",
        "iso88597", "iso88598", "iso88599", "iso_8859-1", "iso_8859-15",
        "iso_8859-1:1987", "iso_8859-2", "iso_8859-2:1987", "iso_8859-3",
        "iso_8859-3:1988", "iso_8859-4", "iso_8859-4:1988", "iso_8859-5",
        "iso_8859-5:1988", "iso_8859-6", "iso_8859-6:1987", "iso_8859-7",
        "iso_8859-7:1987", "iso_8859-8", "iso_8859-8:1988", "iso_8859-9",
        "iso_8859-9:1989", "koi", "koi8", "koi8-r", "koi8-ru", "koi8-u",
        "koi8_r", "korean", "ks_c_5601-1987", "ks_c_5601-1989", "ksc5601",
        "ksc_5601", "l1", "l2", "l3", "l4", "l5", "l6", "l9", "latin1",
        "latin2", "latin3", "latin4", "latin5", "latin6", "logical", "mac",
        "macintosh", "ms932", "ms_kanji", "shift-jis", "shift_jis", "sjis",
        "sun_eu_greek", "tis-620", "unicode-1-1-utf-8", "us-ascii",
        "utf-16", "utf-16be", "utf-16le", "utf-8", "utf8", "visual",
        "windows-1250", "windows-1251", "windows-1252", "windows-1253",
        "windows-1254", "windows-1255", "windows-1256", "windows-1257",
        "windows-1258", "windows-31j", "windows-874", "windows-949",
        "x-cp1250", "x-cp1251", "x-cp1252", "x-cp1253", "x-cp1254",
        "x-cp1255", "x-cp1256", "x-cp1257", "x-cp1258", "x-euc-jp", "x-gbk",
        "x-mac-cyrillic", "x-mac-roman", "x-mac-ukrainian", "x-sjis",
        "x-user-defined", "x-x-big5"];

    Sao.Window = {};

    Sao.Window.InfoBar = Sao.class_(Object, {
        init: function() {
            this.text = jQuery('<span/>');
            this.text.css('white-space', 'pre-wrap');
            this.el= jQuery('<div/>', {
                'class': 'alert infobar',
                'role': 'alert'
            }).append(jQuery('<button/>', {
                'type': 'button',
                'class': 'close stretched-link',
                'aria-label': Sao.i18n.gettext('Close')
            }).append(jQuery('<span/>', {
                'aria-hidden': true
            }).append('&times;')).click(function() {
                this.text.text('');
                this.el.hide();
            }.bind(this))).append(this.text);
            this.el.hide();
        },
        message: function(message, type) {
            if (message) {
                this.el.removeClass(
                        'alert-success alert-info alert-warning alert-danger');
                this.el.addClass('alert-' + (type || 'info'));
                this.text.text(message);
                this.el.show();
            } else {
                this.text.text('');
                this.el.hide();
            }
        }
    });

    Sao.Window.Form = Sao.class_(Object, {
        init: function(screen, callback, kwargs) {
            kwargs = kwargs || {};
            this.screen = screen;
            this.callback = callback;
            this.many = kwargs.many || 0;
            this.domain = kwargs.domain || null;
            this.context = kwargs.context || null;
            this.save_current = kwargs.save_current;
            var title_prm = jQuery.when(kwargs.title || '');
            title_prm.then(function(title) {
                if (!title) {
                    title = Sao.common.MODELNAME.get(this.screen.model_name);
                }
                this.title = title;
            }.bind(this));

            this.prev_view = screen.current_view;
            this.screen.screen_container.alternate_view = true;
            this.info_bar = new Sao.Window.InfoBar();
            var view_type = kwargs.view_type || 'form';

            this.switch_prm = this.screen.switch_view(view_type)
                .done(function() {
                    if (kwargs.new_ &&
                        (this.screen.current_view.view_type == view_type)) {
                        this.screen.new_(undefined, kwargs.rec_name);
                    }
                }.bind(this));
            var dialog = new Sao.Dialog('', 'window-form', 'lg', false);
            this.el = dialog.modal;
            this.el.on('keydown', function(e) {
                if (e.which == Sao.common.ESC_KEYCODE) {
                    e.preventDefault();
                    this.response('RESPONSE_CANCEL');
                }
            }.bind(this));

            var readonly = (this.screen.attributes.readonly ||
                    this.screen.group.readonly);

            this._initial_value = null;
            if (view_type == 'form') {
                var button_text;
                if (kwargs.new_) {
                    button_text = Sao.i18n.gettext('Delete');
                } else {
                    button_text = Sao.i18n.gettext('Cancel');
                    this._initial_value = this.screen.current_record.get_eval();
                }

                dialog.footer.append(jQuery('<button/>', {
                    'class': 'btn btn-link',
                    'type': 'button'
                }).text(button_text).click(function() {
                    this.response('RESPONSE_CANCEL');
                }.bind(this)));
            }

            if (kwargs.new_ && this.many) {
                dialog.footer.append(jQuery('<button/>', {
                    'class': 'btn btn-default',
                    'type': 'button'
                }).text(Sao.i18n.gettext('New')).click(function() {
                    this.response('RESPONSE_ACCEPT');
                }.bind(this)));
            }

            if (this.save_current) {
                dialog.footer.append(jQuery('<button/>', {
                    'class': 'btn btn-primary',
                    'type': 'submit'
                }).text(Sao.i18n.gettext('Save')));
            } else {
                dialog.footer.append(jQuery('<button/>', {
                    'class': 'btn btn-primary',
                    'type': 'submit'
                }).text(Sao.i18n.gettext('OK')));
            }
            dialog.content.submit(function(e) {
                this.response('RESPONSE_OK');
                e.preventDefault();
            }.bind(this));

            if (view_type == 'tree') {
                var menu = jQuery('<div/>', {
                    'class': 'window-form-toolbar'
                }).appendTo(dialog.body);
                var group = jQuery('<div/>', {
                    'class': 'input-group input-group-sm'
                }).appendTo(menu);

                this.wid_text = jQuery('<input/>', {
                    type: 'input'
                }).appendTo(menu);
                this.wid_text.hide();

                var buttons = jQuery('<div/>', {
                    'class': 'input-group-btn'
                }).appendTo(group);
                var access = Sao.common.MODELACCESS.get(this.screen.model_name);

                var disable_during = function(callback) {
                    return function(evt) {
                        var button = jQuery(evt.target);
                        button.prop('disabled', true);
                        (callback(evt) || jQuery.when())
                            .always(function() {
                                button.prop('disabled', false);
                            });
                    };
                };

                this.but_switch = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('Switch')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-switch')
                ).appendTo(buttons);
                this.but_switch.click(
                    disable_during(this.switch_.bind(this)));

                this.but_previous = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('Previous')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-back')
                ).appendTo(buttons);
                this.but_previous.click(
                    disable_during(this.previous.bind(this)));

                this.label = jQuery('<span/>', {
                    'class': 'badge'
                }).appendTo(jQuery('<span/>', {
                    'class': 'btn hidden-xs',
                }).appendTo(buttons));

                this.but_next = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('Next')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-forward')
                ).appendTo(buttons);
                this.but_next.click(disable_during(this.next.bind(this)));

                if (this.domain) {
                    this.wid_text.show();

                    this.but_add = jQuery('<button/>', {
                        'class': 'btn btn-default btn-sm',
                        'type': 'button',
                        'aria-label': Sao.i18n.gettext('Add')
                    }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-add')
                    ).appendTo(buttons);
                    this.but_add.click(disable_during(this.add.bind(this)));
                    this.but_add.prop('disabled', !access.read || readonly);

                    this.but_remove = jQuery('<button/>', {
                        'class': 'btn btn-default btn-sm',
                        'type': 'button',
                        'aria-label': Sao.i18n.gettext('Remove')
                    }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-remove')
                    ).appendTo(buttons);
                    this.but_remove.click(
                        disable_during(this.remove.bind(this)));
                    this.but_remove.prop('disabled', !access.read || readonly);
                }

                this.but_new = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('New')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-create')
                ).appendTo(buttons);
                this.but_new.click(disable_during(this.new_.bind(this)));
                this.but_new.prop('disabled', !access.create || readonly);

                this.but_del = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('Delete')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-delete')
                ).appendTo(buttons);
                this.but_del.click(disable_during(this.delete_.bind(this)));
                this.but_del.prop('disabled', !access['delete'] || readonly);

                this.but_undel = jQuery('<button/>', {
                    'class': 'btn btn-default btn-sm',
                    'type': 'button',
                    'aria-label': Sao.i18n.gettext('Undelete')
                }).append(Sao.common.ICONFACTORY.get_icon_img('tryton-undo')
                ).appendTo(buttons);
                this.but_undel.click(disable_during(this.undelete.bind(this)));
                this.but_undel.prop('disabled', !access['delete'] || readonly);

                this.screen.message_callback = this.record_label.bind(this);
            }

            var content = jQuery('<div/>').appendTo(dialog.body);

            dialog.body.append(this.info_bar.el);

            this.switch_prm.done(function() {
                if (this.screen.current_view.view_type != view_type) {
                    this.destroy();
                } else {
                    title_prm.done(dialog.add_title.bind(dialog));
                    content.append(this.screen.screen_container.alternate_viewport);
                    this.el.modal('show');
                }
            }.bind(this));
            this.el.on('shown.bs.modal', function(event) {
                this.screen.display().done(function() {
                    this.screen.set_cursor();
                }.bind(this));
            }.bind(this));
            this.el.on('hidden.bs.modal', function(event) {
                jQuery(this).remove();
            });
        },
        record_label: function(data) {
            var name = '_';
            var access = Sao.common.MODELACCESS.get(this.screen.model_name);
            var deletable = this.screen.deletable;
            var readonly = this.screen.group.readonly || this.screen.readonly;
            if (data[0] >= 1) {
                name = data[0];
                if (this.domain) {
                    this.but_remove.prop('disabled', false);
                }
                this.but_next.prop('disabled', data[0] >= data[1]);
                this.but_previous.prop('disabled', data[0] <= 1);
                if (access.delete && !readonly && deletable) {
                    this.but_del.prop('disabled', false);
                    this.but_undel.prop('disabled', false);
                }
            } else {
                this.but_del.prop('disabled', true);
                this.but_undel.prop('disabled', true);
                this.but_next.prop('disabled', true);
                this.but_previous.prop('disabled', true);
                if (this.domain) {
                    this.but_remove.prop('disabled', true);
                }
            }
            var message = name + '/' + data[1];
            this.label.text(message).attr('title', message);
        },
        add: function() {
            var domain = jQuery.extend([], this.domain);
            var model_name = this.screen.model_name;
            var value = this.wid_text.val();

            var callback = function(result) {
                var prm = jQuery.when();
                if (!jQuery.isEmptyObject(result)) {
                    var ids = [];
                    for (var i = 0, len = result.length; i < len; i++) {
                        ids.push(result[i][0]);
                    }
                    this.screen.group.load(ids, true);
                    prm = this.screen.display();
                }
                prm.done(function() {
                    this.screen.set_cursor();
                }.bind(this));
                this.entry.val('');
            }.bind(this);
            var parser = new Sao.common.DomainParser();
            var win = new Sao.Window.Search(model_name, callback, {
                sel_multi: true,
                context: this.context,
                domain: domain,
                search_filter: parser.quote(value)
            });
        },
        remove: function() {
            this.screen.remove(false, true, false);
        },
        new_: function() {
            this.screen.new_();
            this._initial_value = null;
        },
        delete_: function() {
            this.screen.remove(false, false, false);
        },
        undelete: function() {
            this.screen.unremove();
        },
        previous: function() {
            return this.screen.display_previous();
        },
        next: function() {
            return this.screen.display_next();
        },
        switch_: function() {
            return this.screen.switch_view();
        },
        response: function(response_id) {
            var result;
            this.screen.current_view.set_value();
            var readonly = this.screen.group.readonly;
            if (~['RESPONSE_OK', 'RESPONSE_ACCEPT'].indexOf(response_id) &&
                    !readonly &&
                    this.screen.current_record) {
                this.screen.current_record.validate().then(function(validate) {
                    if (validate && this.screen.attributes.pre_validate) {
                        return this.screen.current_record.pre_validate();
                    }
                    return validate;
                }.bind(this)).then(function(validate) {
                    var closing_prm = jQuery.Deferred();
                    if (validate && this.save_current) {
                        this.screen.save_current().then(closing_prm.resolve,
                            closing_prm.reject);
                    } else if (validate &&
                            this.screen.current_view.view_type == 'form') {
                        var view = this.screen.current_view;
                        var validate_prms = [];
                        for (var name in view.widgets) {
                            var widget = view.widgets[name];
                            if (widget.screen &&
                                widget.screen.attributes.pre_validate) {
                                var record = widget.screen.current_record;
                                if (record) {
                                    validate_prms.push(record.pre_validate());
                                }
                            }
                        }
                        jQuery.when.apply(jQuery, validate_prms).then(
                            closing_prm.resolve, closing_prm.reject);
                    } else if (!validate) {
                        this.info_bar.message(
                            this.screen.invalid_message(), 'danger');
                        closing_prm.reject();
                    } else {
                        this.info_bar.message();
                        closing_prm.resolve();
                    }

                    closing_prm.fail(function() {
                        this.screen.display().done(function() {
                            this.screen.set_cursor();
                        }.bind(this));
                    }.bind(this));

                    // TODO Add support for many
                    closing_prm.done(function() {
                        if (response_id == 'RESPONSE_ACCEPT') {
                            this.screen.new_();
                            this.screen.current_view.display().done(function() {
                                this.screen.set_cursor();
                            }.bind(this));
                            this.many -= 1;
                            if (this.many === 0) {
                                this.but_new.prop('disabled', true);
                            }
                        } else {
                            result = true;
                            this.callback(result);
                            this.destroy();
                        }
                    }.bind(this));
                }.bind(this));
                return;
            }

            var cancel_prm = null;
            if (response_id == 'RESPONSE_CANCEL' &&
                    !readonly &&
                    this.screen.current_record) {
                result = false;
                var record = this.screen.current_record;
                var added = record._changed.id;
                if ((record.id < 0) || this.save_current) {
                    cancel_prm = this.screen.cancel_current(
                        this._initial_value);
                } else if (record.has_changed()) {
                    record.cancel();
                    cancel_prm = record.reload();
                }
                if (added) {
                    record._changed.id = added;
                }
            } else {
                result = response_id != 'RESPONSE_CANCEL';
            }
            (cancel_prm || jQuery.when()).done(function() {
                this.callback(result);
                this.destroy();
            }.bind(this));
        },
        destroy: function() {
            this.screen.screen_container.alternate_view = false;
            this.screen.screen_container.alternate_viewport.children()
                .detach();
            if (this.prev_view) {
                // Empty when opening from Many2One
                this.screen.switch_view(this.prev_view.view_type);
            }
            this.el.modal('hide');
        }
    });

    Sao.Window.Attachment = Sao.class_(Sao.Window.Form, {
        init: function(record, callback) {
            this.resource = record.model.name + ',' + record.id;
            this.attachment_callback = callback;
            var context = jQuery.extend({}, record.get_context());
            var screen = new Sao.Screen('ir.attachment', {
                domain: [['resource', '=', this.resource]],
                mode: ['tree', 'form'],
                context: context,
            });
            var title = record.rec_name().then(function(rec_name) {
                return Sao.i18n.gettext('Attachments (%1)', rec_name);
            });
            Sao.Window.Attachment._super.init.call(this, screen, this.callback,
                {view_type: 'tree', title: title});
            this.switch_prm = this.switch_prm.then(function() {
                return screen.search_filter();
            });
        },
        callback: function(result) {
            var prm = jQuery.when();
            if (result) {
                prm = this.screen.save_current();
            }
            if (this.attachment_callback) {
                prm.always(this.attachment_callback.bind(this));
            }
        },
        add_data: function(data, filename) {
            var screen = this.screen;
            this.switch_prm.then(function() {
                screen.new_().then(function(record) {
                    var data_field = record.model.fields.data;
                    record.field_set_client(
                        data_field.description.filename, filename);
                    record.field_set_client('data', data);
                    screen.display();
                });
            });
        },
        add_uri: function(uri) {
            var screen = this.screen;
            this.switch_prm.then(function() {
                screen.current_record = null;
                screen.switch_view('form').then(function() {
                    screen.new_().then(function(record) {
                        record.field_set_client('link', uri);
                        record.field_set_client('type', 'link');
                        screen.display();
                    });
                });
            });
        },
        add_text: function(text) {
            var screen = this.screen;
            this.switch_prm.then(function() {
                screen.current_record = null;
                screen.switch_view('form').then(function() {
                    screen.new_().then(function(record) {
                        record.field_set_client('description', text);
                        screen.display();
                    });
                });
            });
        },
    });
    Sao.Window.Attachment.get_attachments = function(record) {
        var prm;
        if (record && (record.id >= 0)) {
            var context = record.get_context();
            prm = Sao.rpc({
                'method': 'model.ir.attachment.search_read',
                'params': [
                    [['resource', '=', record.model.name + ',' + record.id]],
                    0, 20, null, ['rec_name', 'name', 'type', 'link'],
                    context],
            }, record.model.session);
        } else {
            prm = jQuery.when([]);
        }
        var partial = function(callback, attachment, context, session) {
            return function() {
                return callback(attachment, context, session);
            };
        };
        return prm.then(function(attachments) {
            return attachments.map(function(attachment) {
                var name = attachment.rec_name;
                if (attachment.type == 'link') {
                    return [name, attachment.link];
                } else {
                    var callback = Sao.Window.Attachment[
                        'open_' + attachment.type];
                    return [name, partial(
                        callback, attachment, context, record.model.session)];
                }
            });
        });
    };
    Sao.Window.Attachment.open_data = function(attachment, context, session) {
        Sao.rpc({
            'method': 'model.ir.attachment.read',
            'params': [
                [attachment.id], ['data'], context],
        }, session).then(function(values) {
            Sao.common.download_file(values[0].data, attachment.name);
        });
    };

    Sao.Window.Note = Sao.class_(Sao.Window.Form, {
        init: function(record, callback) {
            this.resource = record.model.name + ',' + record.id;
            this.note_callback = callback;
            var context = jQuery.extend({}, record.get_context());
            var screen = new Sao.Screen('ir.note', {
                domain: [['resource', '=', this.resource]],
                mode: ['tree', 'form'],
                context: context,
            });
            var title = record.rec_name().then(function(rec_name) {
                return Sao.i18n.gettext('Notes (%1)', rec_name);
            });
            Sao.Window.Note._super.init.call(this, screen, this.callback,
                {view_type: 'tree', title: title});
            this.switch_prm = this.switch_prm.then(function() {
                return screen.search_filter();
            });
        },
        callback: function(result) {
            var prm = jQuery.when();
            if (result) {
                var unread = this.screen.group.model.fields.unread;
                this.screen.group.forEach(function(record) {
                    if (record.get_loaded() || record.id < 0) {
                        if (!record._changed.unread) {
                            unread.set_client(record, false);
                        }
                    }
                }.bind(this));
                prm = this.screen.save_current();
            }
            if (this.note_callback) {
                prm.always(this.note_callback.bind(this));
            }
        }
    });

    Sao.Window.Search = Sao.class_(Object, {
        init: function(model, callback, kwargs) {
            kwargs = kwargs || {};
            var views_preload = kwargs.views_preload || {};
            this.model_name = model;
            this.domain = kwargs.domain || [];
            this.context = kwargs.context || {};
            this.order = kwargs.order || null;
            this.view_ids = kwargs.view_ids;
            this.views_preload = views_preload;
            this.sel_multi = kwargs.sel_multi;
            this.callback = callback;
            var title = kwargs.title;
            if (!title) {
                title = Sao.common.MODELNAME.get(model);
            }
            this.title = title;
            this.exclude_field = kwargs.exclude_field || null;
            var dialog = new Sao.Dialog(Sao.i18n.gettext(
                'Search %1', this.title), '', 'lg');
            this.el = dialog.modal;

            jQuery('<button/>', {
                'class': 'btn btn-link',
                'type': 'button'
            }).text(Sao.i18n.gettext('Cancel')).click(function() {
                this.response('RESPONSE_CANCEL');
            }.bind(this)).appendTo(dialog.footer);
            jQuery('<button/>', {
                'class': 'btn btn-default',
                'type': 'button'
            }).text(Sao.i18n.gettext('Find')).click(function() {
                this.response('RESPONSE_APPLY');
            }.bind(this)).appendTo(dialog.footer);
            if (kwargs.new_ && Sao.common.MODELACCESS.get(model).create) {
                jQuery('<button/>', {
                    'class': 'btn btn-default',
                    'type': 'button'
                }).text(Sao.i18n.gettext('New')).click(function() {
                    this.response('RESPONSE_ACCEPT');
                }.bind(this)).appendTo(dialog.footer);
            }
            jQuery('<button/>', {
                'class': 'btn btn-primary',
                'type': 'submit'
            }).text(Sao.i18n.gettext('OK')).appendTo(dialog.footer);
            dialog.content.submit(function(e) {
                this.response('RESPONSE_OK');
                e.preventDefault();
            }.bind(this));

            this.screen = new Sao.Screen(model, {
                mode: ['tree'],
                context: this.context,
                domain: this.domain,
                order: this.order,
                view_ids: kwargs.view_ids,
                views_preload: views_preload,
                row_activate: this.activate.bind(this),
                readonly: true,
            });
            this.screen.load_next_view().done(function() {
                this.screen.switch_view().done(function() {
                    if (!this.sel_multi) {
                        this.screen.current_view.selection_mode = (
                            Sao.common.SELECTION_SINGLE);
                    } else {
                        this.screen.current_view.selection_mode = (
                            Sao.common.SELECTION_MULTIPLE);
                    }
                    dialog.body.append(this.screen.screen_container.el);
                    this.el.modal('show');
                    this.screen.display();
                    if (kwargs.search_filter !== undefined) {
                        this.screen.search_filter(kwargs.search_filter);
                    }
                }.bind(this));
            }.bind(this));
            this.el.on('hidden.bs.modal', function(event) {
                jQuery(this).remove();
            });
        },
        activate: function() {
            this.response('RESPONSE_OK');
        },
        response: function(response_id) {
            var records;
            var value = [];
            if (response_id == 'RESPONSE_OK') {
                records = this.screen.current_view.selected_records;
            } else if (response_id == 'RESPONSE_APPLY') {
                this.screen.search_filter();
                return;
            } else if (response_id == 'RESPONSE_ACCEPT') {
                var view_ids = jQuery.extend([], this.view_ids);
                if (!jQuery.isEmptyObject(view_ids)) {
                    // Remove the first tree view as mode is form only
                    view_ids.shift();
                }
                var screen = new Sao.Screen(this.model_name, {
                    domain: this.domain,
                    context: this.context,
                    order: this.order,
                    mode: ['form'],
                    view_ids: view_ids,
                    views_preload: this.views_preload,
                    exclude_field: this.exclude_field,
                });

                var callback = function(result) {
                    if (result) {
                        var record = screen.current_record;
                        this.callback([[record.id,
                            record._values.rec_name || '']]);
                    } else {
                        this.callback(null);
                    }
                };
                this.el.modal('hide');
                new Sao.Window.Form(screen, callback.bind(this), {
                    new_: true,
                    save_current: true,
                    title: this.title
                });
                return;
            }
            if (records) {
                var index, record;
                for (index in records) {
                    record = records[index];
                    value.push([record.id, record._values.rec_name || '']);
                }
            }
            this.callback(value);
            this.el.modal('hide');
        }
    });

    Sao.Window.Preferences = Sao.class_(Object, {
        init: function(callback) {
            this.callback = callback;
            var dialog = new Sao.Dialog('Preferences', '', 'lg');
            this.el = dialog.modal;

            jQuery('<button/>', {
                'class': 'btn btn-link',
                'type': 'button'
            }).text(Sao.i18n.gettext('Cancel')).click(function() {
                this.response('RESPONSE_CANCEL');
            }.bind(this)).appendTo(dialog.footer);
            jQuery('<button/>', {
                'class': 'btn btn-primary',
                'type': 'submit'
            }).text(Sao.i18n.gettext('OK')).appendTo(dialog.footer);
            dialog.content.submit(function(e) {
                this.response('RESPONSE_OK');
                e.preventDefault();
            }.bind(this));

            this.screen = new Sao.Screen('res.user', {
                mode: []
            });
            // Reset readonly set automaticly by MODELACCESS
            this.screen.attributes.readonly = false;
            this.screen.group.readonly = false;
            this.screen.group.skip_model_access = true;

            var set_view = function(view) {
                this.screen.add_view(view);
                this.screen.switch_view().done(function() {
                    this.screen.new_(false);
                    this.screen.model.execute('get_preferences', [false], {})
                    .then(set_preferences.bind(this), this.destroy);
                }.bind(this));
            };
            var set_preferences = function(preferences) {
                this.screen.current_record.cancel();
                this.screen.current_record.set(preferences);
                this.screen.current_record.id =
                    this.screen.model.session.user_id;
                this.screen.current_record.validate(null, true).then(
                    function() {
                        this.screen.display(true);
                    }.bind(this));
                dialog.body.append(this.screen.screen_container.el);
                this.el.modal('show');
            };
            this.el.on('hidden.bs.modal', function(event) {
                jQuery(this).remove();
            });

            this.screen.model.execute('get_preferences_fields_view', [], {})
                .then(set_view.bind(this), this.destroy);
        },
        response: function(response_id) {
            var end = function() {
                this.destroy();
                this.callback();
            }.bind(this);
            var prm = jQuery.when();
            if (response_id == 'RESPONSE_OK') {
                prm = this.screen.current_record.validate()
                    .then(function(validate) {
                        if (validate) {
                            var values = jQuery.extend({}, this.screen.get());
                            return this.screen.model.execute(
                                'set_preferences', [values], {});
                        }
                    }.bind(this));
            }
            prm.done(end);
        },
        destroy: function() {
            this.el.modal('hide');
        }
    });

    Sao.Window.Revision = Sao.class_(Object, {
        init: function(revisions, callback) {
            this.callback = callback;
            var dialog = new Sao.Dialog(
                    Sao.i18n.gettext('Revision'), '', 'lg');
            this.el = dialog.modal;

            jQuery('<button/>', {
                'class': 'btn btn-link',
                'type': 'button'
            }).text(Sao.i18n.gettext('Cancel')).click(function() {
                this.response('RESPONSE_CANCEL');
            }.bind(this)).appendTo(dialog.footer);
            jQuery('<button/>', {
                'class': 'btn btn-primary',
                'type': 'submit'
            }).text(Sao.i18n.gettext('OK')).appendTo(dialog.footer);
            dialog.content.submit(function(e) {
                this.response('RESPONSE_OK');
                e.preventDefault();
            }.bind(this));

            var group = jQuery('<div/>', {
                'class': 'form-group'
            }).appendTo(dialog.body);
            jQuery('<label/>', {
                'for': 'revision',
                'text': 'Revision'
            }).appendTo(group);
            this.select = jQuery('<select/>', {
                'class': 'form-control',
                id: 'revision',
                'placeholder': Sao.i18n.gettext('Revision')
            }).appendTo(group);
            var date_format = Sao.common.date_format();
            var time_format = '%H:%M:%S.%f';
            this.select.append(jQuery('<option/>', {
                value: null,
                text: ''
            }));
            revisions.forEach(function(revision) {
                var name = revision[2];
                revision = revision[0];
                this.select.append(jQuery('<option/>', {
                    value: revision.valueOf(),
                    text: Sao.common.format_datetime(
                        date_format, time_format, revision) + ' ' + name,
                }));
            }.bind(this));
            this.el.modal('show');
            this.el.on('hidden.bs.modal', function(event) {
                jQuery(this).remove();
            });
        },
        response: function(response_id) {
            var revision = null;
            if (response_id == 'RESPONSE_OK') {
                revision = this.select.val();
                if (revision) {
                    revision = Sao.DateTime(parseInt(revision, 10));
                }
            }
            this.el.modal('hide');
            this.callback(revision);
        }
    });

    Sao.Window.CSV = Sao.class_(Object, {
        init: function(title) {
            this.dialog = new Sao.Dialog(title, 'csv', 'lg');
            this.el = this.dialog.modal;

            this.fields = {};
            this.fields_model = {};
            jQuery('<button/>', {
                'class': 'btn btn-link',
                'type': 'button'
            }).text(Sao.i18n.gettext('Cancel')).click(function(){
                this.response('RESPONSE_CANCEL');
            }.bind(this)).appendTo(this.dialog.footer);

            jQuery('<button/>', {
                'class': 'btn btn-primary',
                'type': 'submit'
            }).text(Sao.i18n.gettext('OK')).click(function(e){
                this.response('RESPONSE_OK');
                e.preventDefault();
            }.bind(this)).appendTo(this.dialog.footer);

            var row_fields = jQuery('<div/>', {
                'class': 'row'
            }).appendTo(this.dialog.body);

            var column_fields_all = jQuery('<div/>', {
                'class': 'col-md-5',
            }).append(jQuery('<div/>', {
                'class': 'panel panel-default',
            }).append(jQuery('<div/>', {
                'class': 'panel-heading',
            }).append(jQuery('<h3/>', {
                'class': 'panel-title',
                'text': Sao.i18n.gettext('All Fields')
            })))).appendTo(row_fields);

            this.fields_all = jQuery('<ul/>', {
                'class': 'list-unstyled column-fields panel-body'
            }).css('cursor', 'pointer')
                .appendTo(column_fields_all.find('.panel'));

            this.model_populate(this._get_fields(this.screen.model_name));
            this.view_populate(this.fields_model, this.fields_all);

            this.column_buttons = jQuery('<div/>', {
                'class': 'col-md-2'
            }).appendTo(row_fields);

            var button_add = jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Add')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-add')
            ).click(function(){
                this.fields_all.find('.bg-primary').each(function(i, el_field) {
                    this.sig_sel_add(el_field);
                }.bind(this));
            }.bind(this))
            .appendTo(this.column_buttons);

            jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Remove')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-remove')
            ).click(function(){
                // sig_unsel
                this.fields_selected.children('li.bg-primary').remove();
            }.bind(this))
            .appendTo(this.column_buttons);

            jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Clear')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-clear')
            ).click(function(){
                this.fields_selected.empty();
            }.bind(this))
            .appendTo(this.column_buttons);

            jQuery('<hr>').appendTo(this.column_buttons);

            var column_fields_selected = jQuery('<div/>', {
                'class': 'col-md-5',
            }).append(jQuery('<div/>', {
                'class': 'panel panel-default',
            }).append(jQuery('<div/>', {
                'class': 'panel-heading',
            }).append(jQuery('<h3/>', {
                'class': 'panel-title',
                'text': Sao.i18n.gettext('Fields Selected')
            })))).appendTo(row_fields);

            // TODO: Make them draggable to re-order
            this.fields_selected = jQuery('<ul/>', {
                'class': 'list-unstyled column-fields panel-body',
            }).css('cursor', 'pointer')
                .appendTo(column_fields_selected.find('.panel'));

            this.chooser_form = jQuery('<div/>', {
                'class': 'form-inline'
            }).appendTo(this.dialog.body);

            var row_csv_param = jQuery('<div/>', {
            }).appendTo(this.dialog.body);

            var csv_param_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('CSV Parameters')
            }).css('cursor', 'pointer')
            .on('click', function(){
                this.expander_csv.collapse('toggle');
            }.bind(this)).appendTo(row_csv_param);

            var expander_icon = jQuery('<span/>', {
                'class': 'caret',
            }).css('cursor', 'pointer').html('&nbsp;')
            .appendTo(row_csv_param);

            this.expander_csv = jQuery('<div/>', {
                'id': 'expander_csv',
                'class': 'collapse form-inline'
            }).appendTo(row_csv_param);

            var delimiter_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('Delimiter:'),
                'class': 'control-label',
                'for': 'input-delimiter'
            });

            var separator = ',';
            if (navigator.platform &&
                    navigator.platform.slice(0, 3) == 'Win') {
                separator = ';';
            }
            this.el_csv_delimiter = jQuery('<input/>', {
                'type': 'text',
                'class': 'form-control',
                'id': 'input-delimiter',
                'size': '1',
                'maxlength': '1',
                'value': separator
            });

            jQuery('<div/>', {
                'class': 'form-group'
            }).append(delimiter_label)
                .append(this.el_csv_delimiter)
                .appendTo(this.expander_csv);
            this.expander_csv.append(' ');

            var quotechar_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('Quote Char:'),
                'class': 'control-label',
                'for': 'input-quotechar'
            });

            this.el_csv_quotechar = jQuery('<input/>', {
                'type': 'text',
                'class': 'form-control',
                'id': 'input-quotechar',
                'size': '1',
                'maxlength': '1',
                'value': '\"',
            });

            jQuery('<div/>', {
                'class': 'form-group'
            }).append(quotechar_label)
                .append(this.el_csv_quotechar)
                .appendTo(this.expander_csv);
            this.expander_csv.append(' ');

            this.el.modal('show');
            this.el.on('hidden.bs.modal', function() {
                jQuery(this).remove();
            });
        },
        _get_fields: function(model) {
            return Sao.rpc({
                'method': 'model.' + model + '.fields_get'
            }, this.session, false);
        },
        on_row_expanded: function(node) {
            var container_view = jQuery('<ul/>').css('list-style', 'none')
                .insertAfter(node.view);
            this.children_expand(node);
            this.view_populate(node.children, container_view);
        },
        destroy: function() {
            this.el.modal('hide');
        }
    });

    Sao.Window.Import = Sao.class_(Sao.Window.CSV, {
        init: function(name, screen) {
            this.name = name;
            this.screen = screen;
            this.session = Sao.Session.current_session;
            this.fields_data = {}; // Ask before Removing this.
            this.fields_invert = {};
            Sao.Window.Import._super.init.call(this,
                Sao.i18n.gettext('CSV Import: %1', name));

            jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Auto-Detect')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-search')
            ).click(function(){
                this.autodetect();
            }.bind(this))
            .appendTo(this.column_buttons);

            var chooser_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('File to Import'),
                'class': 'col-sm-6 control-label',
                'for': 'input-csv-file'
            });

            this.file_input = jQuery('<input/>', {
                'type': 'file',
                'id': 'input-csv-file'
            });

            jQuery('<div/>', {
                'class': 'form-group'
            }).append(chooser_label).append(jQuery('<div/>', {
                'class': 'col-sm-6'
            }).append(this.file_input))
            .appendTo(this.chooser_form);

            var encoding_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('Encoding:'),
                'class': 'control-label',
                'for': 'input-encoding'
            });

            this.el_csv_encoding = jQuery('<select/>', {
                'class': 'form-control',
                'id': 'input-encoding'
            });

            for(var i=0; i < ENCODINGS.length; i++) {
                jQuery('<option/>', {
                    'val': ENCODINGS[i]
                }).append(ENCODINGS[i]).appendTo(this.el_csv_encoding);
            }

            var enc = 'utf-8';
            if (navigator.platform &&
                    navigator.platform.slice(0, 3) == 'Win') {
                enc = 'cp1252';
            }
            this.el_csv_encoding.children('option[value="' + enc + '"]')
            .attr('selected', 'selected');

            jQuery('<div/>', {
                'class': 'form-group'
            }).append(encoding_label)
                .append(this.el_csv_encoding)
                .appendTo(this.expander_csv);
            this.expander_csv.append(' ');

            var skip_label = jQuery('<label/>', {
                'text': Sao.i18n.gettext('Lines to Skip:'),
                'class': 'control-label',
                'for': 'input-skip'
            });

            this.el_csv_skip = jQuery('<input/>', {
                'type': 'number',
                'class': 'form-control',
                'id': 'input-skip',
                'value': '0'
            });

            jQuery('<div/>', {
                'class': 'form-group'
            }).append(skip_label)
                .append(this.el_csv_skip)
                .appendTo(this.expander_csv);
            this.expander_csv.append(' ');
        },
        sig_sel_add: function(el_field) {
            el_field = jQuery(el_field);
            var field = el_field.attr('field');
            var node = jQuery('<li/>', {
                'field': field,
            }).text(el_field.attr('name')).click(function(e) {
                if (e.ctrlKey) {
                    node.toggleClass('bg-primary');
                } else {
                    jQuery(e.target).addClass('bg-primary')
                        .siblings().removeClass('bg-primary');
                }
            }).appendTo(this.fields_selected);
        },
        view_populate: function (parent_node, parent_view) {
            var fields_order = Object.keys(parent_node).sort(function(a,b) {
                if (parent_node[b].string < parent_node[a].string) {
                    return -1;
                }
                else {
                    return 1;
                }
            }).reverse();

            fields_order.forEach(function(field) {
                var name = parent_node[field].string || field;
                var node = jQuery('<li/>', {
                    'field': parent_node[field].field,
                    'name': parent_node[field].name
                }).text(name).click(function(e) {
                    if(e.ctrlKey) {
                        node.toggleClass('bg-primary');
                    } else {
                        this.fields_all.find('li').removeClass('bg-primary');
                        node.addClass('bg-primary');
                    }
                }.bind(this)).appendTo(parent_view);
                parent_node[field].view = node;
                var expander_icon = Sao.common.ICONFACTORY
                    .get_icon_img('tryton-arrow-right')
                    .data('expanded', false)
                    .click(function(e) {
                        e.stopPropagation();
                        var icon;
                        var expanded = expander_icon.data('expanded');
                        expander_icon.data('expanded', !expanded);
                        if (expanded) {
                            icon = 'tryton-arrow-right';
                            node.next('ul').remove();
                        } else {
                            icon = 'tryton-arrow-down';
                            this.on_row_expanded(parent_node[field]);
                        }
                        Sao.common.ICONFACTORY.get_icon_url(icon)
                            .then(function(url) {
                                expander_icon.attr('src', url);
                            });
                    }.bind(this)).prependTo(node);
                expander_icon.css(
                    'visibility',
                    parent_node[field].relation ? 'visible' : 'hidden');
            }.bind(this));
        },
        model_populate: function (fields, parent_node, prefix_field,
            prefix_name) {
            parent_node = parent_node || this.fields_model;
            prefix_field = prefix_field || '';
            prefix_name = prefix_name || '';

            Object.keys(fields).forEach(function(field) {
                if(!fields[field].readonly || field == 'id') {
                    var name = fields[field].string || field;
                    name = prefix_name + name;
                    // Only One2Many can be nested for import
                    var relation;
                    if (fields[field].type == 'one2many') {
                        relation = fields[field].relation;
                    } else {
                        relation = null;
                    }
                    var node = {
                        name: name,
                        field: prefix_field + field,
                        relation: relation,
                        string: fields[field].string
                    };
                    parent_node[field] = node;
                    this.fields[prefix_field + field] = node;
                    this.fields_invert[name] = prefix_field + field;
                    if (relation) {
                        node.children = {};
                    }
                }
            }.bind(this));
        },
        children_expand: function(node) {
            if (jQuery.isEmptyObject(node.children)) {
                this.model_populate(
                    this._get_fields(node.relation), node.children,
                    node.field + '/', node.name + '/');
            }
        },
        autodetect: function() {
            var fname = this.file_input.val();
            if(!fname) {
                Sao.common.message.run(
                    Sao.i18n.gettext('You must select an import file first.'));
                return;
            }
            this.fields_selected.empty();
            this.el_csv_skip.val(1);
            Papa.parse(this.file_input[0].files[0], {
                delimiter: this.el_csv_delimiter.val(),
                quoteChar: this.el_csv_quotechar.val(),
                preview: 1,
                encoding: this.el_csv_encoding.val(),
                error: function(err, file, inputElem, reason) {
                    Sao.common.warning(
                        Sao.i18n.gettext(
                            'An error occured in loading the file.'));
                },
                complete: function(results) {
                    results.data[0].forEach(function(word) {
                        if (!(word in this.fields_invert) && !(word in this.fields)) {
                            var fields = this.fields_model;
                            var prefix = '';
                            var parents = word.split('/').slice(0, -1);
                            this._traverse(fields, prefix, parents, 0);
                        }
                        this._auto_select(word);
                    }.bind(this));
                }.bind(this)
            });
        },
        _auto_select: function(word) {
            var name,field;
            if(word in this.fields_invert) {
                name = word;
                field = this.fields_invert[word];
            }
            else if (word in this.fields) {
                name = this.fields[word].name;
                field = [word];
            }
            else {
                Sao.common.warning.run(
                    Sao.i18n.gettext(
                        'Error processing the file at field %1.', word),
                        Sao.i18n.gettext('Error'));
                return;
            }
            var node = jQuery('<li/>', {
                'field': field
            }).text(name).click(function(){
                node.addClass('bg-primary')
                    .siblings().removeClass('bg-primary');
            }).appendTo(this.fields_selected);
        },
        _traverse: function(fields, prefix, parents, i) {
            var field, item;
            var names = Object.keys(fields);
            for (item = 0; item<names.length; item++) {
                field = fields[names[item]];
                if (field.name == (prefix + parents[i]) ||
                    field.field == (prefix + parents[i])) {
                    this.children_expand(field);
                    fields = field.children;
                    prefix += parents[i] + '/';
                    this._traverse(fields, prefix, parents, ++i);
                    break;
                }
            }
        },
        response: function(response_id) {
            if(response_id == 'RESPONSE_OK') {
                var fields = [];
                this.fields_selected.children('li').each(function(i, field_el) {
                    fields.push(field_el.getAttribute('field'));
                });
                var fname = this.file_input.val();
                if(fname) {
                    this.import_csv(fname, fields).then(function() {
                        this.destroy();
                    }.bind(this));
                } else {
                    this.destroy();
                }
            }
            else {
                this.destroy();
            }
        },
        import_csv: function(fname, fields) {
            var skip = this.el_csv_skip.val();
            var encoding = this.el_csv_encoding.val();
            var prm = jQuery.Deferred();

            Papa.parse(this.file_input[0].files[0], {
                delimiter: this.el_csv_delimiter.val(),
                quoteChar: this.el_csv_quotechar.val(),
                encoding: encoding,
                error: function(err, file, inputElem, reason) {
                    Sao.common.warning.run(
                        Sao.i18n.gettext('Error occured in loading the file'))
                        .always(prm.reject);
                },
                complete: function(results) {
                    var data = results.data.slice(skip, results.data.length - 1);
                    Sao.rpc({
                        'method': 'model.' + this.screen.model_name +
                        '.import_data',
                        'params': [fields, data, {}]
                    }, this.session).then(function(count) {
                        return Sao.common.message.run(
                            Sao.i18n.ngettext('%1 record imported',
                                '%1 records imported', count));
                    }).then(prm.resolve, prm.reject);
                }.bind(this)
            });
            return prm.promise();
        }
    });

    Sao.Window.Export = Sao.class_(Sao.Window.CSV, {
        init: function(name, screen, names) {
            this.name = name;
            this.screen = screen;
            this.session = Sao.Session.current_session;
            Sao.Window.Export._super.init.call(this,
                Sao.i18n.gettext('CSV Export: %1',name));
            var fields = this.screen.model.fields;
            names.forEach(function(name) {
                var type = fields[name].description.type;
                if (type == 'selection') {
                    this.sel_field(name + '.translated');
                } else if (type == 'reference') {
                    this.sel_field(name + '.translated');
                    this.sel_field(name + '/rec_name');
                } else {
                    this.sel_field(name);
                }
            }.bind(this));

            this.predef_exports = {};
            this.fill_predefwin();

            jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Save Export')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-save')
            ).click(function(){
                this.addreplace_predef();
            }.bind(this))
            .appendTo(this.column_buttons);

            this.button_url = jQuery('<a/>', {
                'class': 'btn btn-default btn-block',
                'target': '_blank',
                'rel': 'noreferrer noopener',
            }).text(' ' + Sao.i18n.gettext("URL Export")).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-public')
            )
            .appendTo(this.column_buttons);
            this.dialog.body.on('change click', this.set_url.bind(this));

            jQuery('<button/>', {
                'class': 'btn btn-default btn-block',
                'type': 'button'
            }).text(' ' + Sao.i18n.gettext('Delete Export')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-delete')
            ).click(function(){
                this.remove_predef();
            }.bind(this))
            .appendTo(this.column_buttons);

            var predefined_exports_column = jQuery('<div/>', {
                'class': 'panel panel-default',
            }).append(jQuery('<div/>', {
                'class': 'panel-heading',
            }).append(jQuery('<h3/>', {
                'class': 'panel-title',
                'text': Sao.i18n.gettext('Predefined Exports')
            }))).appendTo(this.column_buttons);

            this.predef_exports_list = jQuery('<ul/>', {
                'class': 'list-unstyled predef-exports panel-body'
            }).css('cursor', 'pointer')
            .appendTo(predefined_exports_column);

            this.selected_records = jQuery('<select/>', {
                'class': 'form-control',
                'id': 'input-records',
            }).append(jQuery('<option/>', {
                'val': true,
            }).text(Sao.i18n.gettext("Selected Records")))
                .append(jQuery('<option/>', {
                    'val': false,
                }).text(Sao.i18n.gettext("Listed Records")));

            this.ignore_search_limit = jQuery('<input/>', {
                'type': 'checkbox',
            });

            this.selected_records.change(function() {
                this.ignore_search_limit.parents('.form-group').first().toggle(
                    !JSON.parse(this.selected_records.val()));
            }.bind(this));

            jQuery('<div/>', {
                'class': 'form-group',
            }).appendTo(this.chooser_form)
            .append(jQuery('<label/>', {
                'text': Sao.i18n.gettext("Export:"),
                'class': 'control-label',
                'for': 'input-records',
            })).append(this.selected_records);

            jQuery('<div/>', {
                'class': 'form-group',
            }).appendTo(this.chooser_form)
            .append(jQuery('<div/>', {
                'class': 'checkbox',
            }).append(jQuery('<label/>', {
                'text': ' ' + Sao.i18n.gettext("Ignore search limit")
            }).prepend(this.ignore_search_limit)))
            .hide();

            this.el_csv_locale = jQuery('<input/>', {
                'type': 'checkbox',
                'checked': 'checked',
            });

            jQuery('<div/>', {
                'class': 'checkbox',
            }).append(jQuery('<label/>', {
                'text': ' ' + Sao.i18n.gettext("Use locale format"),
            }).prepend(this.el_csv_locale)).appendTo(this.expander_csv);
            this.expander_csv.append(' ');

            this.el_add_field_names = jQuery('<input/>', {
                'type': 'checkbox',
                'checked': 'checked'
            });

            jQuery('<div/>', {
                'class': 'checkbox',
            }).append(jQuery('<label/>', {
                'text': ' '+Sao.i18n.gettext('Add Field Names')
            }).prepend(this.el_add_field_names)).appendTo(this.expander_csv);
            this.expander_csv.append(' ');

            this.set_url();
        },
        get context() {
            return this.screen.context;
        },
        view_populate: function(parent_node, parent_view) {
            var names = Object.keys(parent_node).sort(function(a, b) {
                if (parent_node[b].string < parent_node[a].string) {
                    return -1;
                }
                else {
                    return 1;
                }
            }).reverse();

            names.forEach(function(name) {
                var path = parent_node[name].path;
                var node = jQuery('<li/>', {
                    'path': path
                }).text(parent_node[name].string).click(function(e) {
                    if(e.ctrlKey) {
                        node.toggleClass('bg-primary');
                    } else {
                        this.fields_all.find('li')
                            .removeClass('bg-primary');
                        node.addClass('bg-primary');
                    }
                }.bind(this)).appendTo(parent_view);
                parent_node[name].view = node;

                var expander_icon = Sao.common.ICONFACTORY
                    .get_icon_img('tryton-arrow-right')
                    .data('expanded', false)
                    .click(function(e) {
                        e.stopPropagation();
                        var icon;
                        var expanded = expander_icon.data('expanded');
                        expander_icon.data('expanded', !expanded);
                        if (expanded) {
                            icon = 'tryton-arrow-right';
                            node.next('ul').remove();
                        } else {
                            icon = 'tryton-arrow-down';
                            this.on_row_expanded(parent_node[name]);
                        }
                        Sao.common.ICONFACTORY.get_icon_url(icon)
                            .then(function(url) {
                                expander_icon.attr('src', url);
                            });
                    }.bind(this)).prependTo(node);
                expander_icon.css(
                    'visibility',
                    parent_node[name].children ? 'visible' : 'hidden');
            }.bind(this));
        },
        model_populate: function(fields, parent_node, prefix_field,
            prefix_name) {
            parent_node = parent_node || this.fields_model;
            prefix_field = prefix_field || '';
            prefix_name = prefix_name || '';

            Object.keys(fields).forEach(function(name) {
                var field = fields[name];
                var string = field.string || name;
                var items = [{ name: name, field: field, string: string }];

                if (field.type == 'selection') {
                    items.push({
                        name: name+'.translated',
                        field: field,
                        string: Sao.i18n.gettext('%1 (string)', string)
                    });
                } else if (field.type == 'reference') {
                    items.push({
                        name: name + '.translated',
                        field: field,
                        string: Sao.i18n.gettext("%1 (model name)", string),
                    });
                    items.push({
                        name: name + '/rec_name',
                        field: field,
                        string: Sao.i18n.gettext("%1 (record name)", string),
                    });
                }

                items.forEach(function(item) {
                    var path = prefix_field + item.name;
                    var long_string = prefix_name + item.string;

                    var node = {
                        path: path,
                        string: item.string,
                        long_string: long_string,
                        relation: item.field.relation
                    };
                    parent_node[item.name] = node;
                    this.fields[path] = node;

                    // Insert relation only to real field
                    if (item.name.indexOf('.') == -1 && item.field.relation) {
                        node.children = {};
                    }
                }.bind(this));
            }.bind(this));
        },
        children_expand: function(node) {
            if (jQuery.isEmptyObject(node.children)) {
                this.model_populate(
                    this._get_fields(node.relation), node.children,
                    node.path + '/', node.long_string + '/');
            }
        },
        sig_sel_add: function(el_field) {
            el_field = jQuery(el_field);
            var name = el_field.attr('path');
            this.sel_field(name);
        },
        fill_predefwin: function() {
            Sao.rpc({
                'method': 'model.ir.export.search_read',
                'params': [
                    [['resource', '=', this.screen.model_name]], 0, null, null,
                    ['name', 'export_fields.name'], {}],
            }, this.session).done(function(exports) {
                exports.forEach(function(export_) {
                    this.predef_exports[export_.id] = export_['export_fields.']
                        .map(function(field) {return field.name;});
                    this.add_to_predef(export_.id, export_.name);
                    this.predef_exports_list.children('li').first().focus();
                }.bind(this));
            }.bind(this));
        },
        add_to_predef: function(id, name) {
            var node = jQuery('<li/>', {
                'text': name,
                'export_id': id,
                'tabindex': 0
            }).on('keypress', function(e) {
                var keyCode = (e.keyCode ? e.keyCode : e.which);
                if(keyCode == 13 || keyCode == 32) {
                    node.click();
                }
            }).click(function(event) {
                node.toggleClass('bg-primary')
                    .siblings().removeClass('bg-primary');
                if (node.hasClass('bg-primary')) {
                    this.sel_predef(node.attr('export_id'));
                }
            }.bind(this));
            this.predef_exports_list.append(node);
        },
        addreplace_predef: function() {
            var fields = [];
            var selected_fields = this.fields_selected.children('li');
            for(var i=0; i<selected_fields.length; i++) {
                fields.push(selected_fields[i].getAttribute('path'));
            }
            if(fields.length === 0) {
                return;
            }
            var pref_id;

            var save = function(name) {
                var prm;
                if (!pref_id) {
                    prm = Sao.rpc({
                        method: 'model.ir.export.create',
                        params: [[{
                            name: name,
                            resource: this.screen.model_name,
                            export_fields: [['create', fields.map(function(f) {
                                return {name: f};
                            })]],
                        }], this.context],
                    }, this.session).then(function(new_ids) {
                        return new_ids[0];
                    });
                } else {
                    prm = Sao.rpc({
                        method: 'model.ir.export.update',
                        params: [[pref_id], fields, this.context],
                    }, this.session).then(function() {
                        return pref_id;
                    });
                }
                return prm.then(function(pref_id) {
                    this.session.cache.clear(
                        'model.' + this.screen.model_name + '.view_toolbar_get');
                    this.predef_exports[pref_id] = fields;
                    if (selection.length === 0) {
                        this.add_to_predef(pref_id, name);
                    }
                    else {
                        selection.attr('export_id', pref_id);
                    }
                }.bind(this));
            }.bind(this);

            var selection = this.predef_exports_list.children('li.bg-primary');
            if (selection.length === 0) {
                pref_id = null;
                Sao.common.ask.run(
                    Sao.i18n.gettext('What is the name of this export?'))
                .then(save);
            }
            else {
                pref_id = selection.attr('export_id');
                Sao.common.sur.run(
                    Sao.i18n.gettext(
                        'Override %1 definition?', selection.text()))
                .then(save);
            }
        },
        remove_predef: function() {
            var selection = this.predef_exports_list.children('li.bg-primary');
            if (selection.length === 0) {
                return;
            }
            var export_id = jQuery(selection).attr('export_id');
            Sao.rpc({
                'method': 'model.ir.export.delete',
                'params': [[export_id], {}]
            }, this.session).then(function() {
                this.session.cache.clear(
                    'model.' + this.screen.model_name + '.view_toolbar_get');
                delete this.predef_exports[export_id];
                selection.remove();
            }.bind(this));
        },
        sel_predef: function(export_id) {
            this.fields_selected.empty();
            this.predef_exports[export_id].forEach(function(name) {
                if (!(name in this.fields)) {
                    var fields = this.fields_model;
                    var prefix = '';
                    var parents = name.split('/').slice(0, -1);
                    this._traverse(fields, prefix, parents, 0);
                }
                if(!(name in this.fields)) {
                    return;
                }
                this.sel_field(name);
            }.bind(this));
        },
        _traverse: function(fields, prefix, parents, i) {
            var field, item;
            var names = Object.keys(fields);
            for (item = 0; item < names.length; item++) {
                field = fields[names[item]];
                if (field.path == (prefix + parents[i])) {
                    this.children_expand(field);
                    fields = field.children;
                    prefix += parents[i] + '/';
                    this._traverse(fields, prefix, parents, ++i);
                    break;
                }
            }
        },
        sel_field: function(name) {
            var long_string = this.fields[name].long_string;
            var relation = this.fields[name].relation;
            if (relation) {
                name += '/rec_name';
            }
            var node = jQuery('<li/>', {
                'path': name,
            }).text(long_string).click(function(e) {
                if(e.ctrlKey) {
                    node.toggleClass('bg-primary');
                } else {
                    jQuery(e.target).addClass('bg-primary')
                        .siblings().removeClass('bg-primary');
                }
            }).appendTo(this.fields_selected);
        },
        response: function(response_id) {
            if(response_id == 'RESPONSE_OK') {
                var fields = [];
                var fields2 = [];
                this.fields_selected.children('li').each(function(i, field) {
                    fields.push(field.getAttribute('path'));
                    fields2.push(field.innerText);
                });

                var prm;
                if (JSON.parse(this.selected_records.val())) {
                    var ids = this.screen.current_view.selected_records.map(function(r) {
                        return r.id;
                    });
                    prm = Sao.rpc({
                        'method': (
                            'model.' + this.screen.model_name +
                            '.export_data'),
                        'params': [ids, fields, this.context]
                    }, this.session);
                } else {
                    var domain = this.screen.search_domain(
                        this.screen.screen_container.get_text());
                    var offset, limit;
                    if (this.ignore_search_limit.prop('checked')) {
                        offset = 0;
                        limit = null;
                    } else {
                        offset = this.screen.offset;
                        limit = this.screen.limit;
                    }
                    prm = Sao.rpc({
                        'method': (
                            'model.' + this.screen.model_name +
                            '.export_data_domain'),
                        'params': [
                            domain, fields, offset, limit, this.screen.order,
                            this.context],
                    }, this.session);
                }
                prm.then(function(data) {
                    this.export_csv(fields2, data).then(function() {
                        this.destroy();
                    }.bind(this));
                }.bind(this));
            } else {
                this.destroy();
            }
        },
        export_csv: function(fields, data) {
            var locale_format = this.el_csv_locale.prop('checked');
            var unparse_obj = {};
            unparse_obj.data = data.map(function(row) {
                return Sao.Window.Export.format_row(row, locale_format);
            });
            if (this.el_add_field_names.is(':checked')) {
                unparse_obj.fields = fields;
            }
            var csv = Papa.unparse(unparse_obj, {
                quoteChar: this.el_csv_quotechar.val(),
                delimiter: this.el_csv_delimiter.val()
            });
            if (navigator.platform &&
                navigator.platform.slice(0, 3) == 'Win') {
                csv = Sao.BOM_UTF8 + csv;
            }
            Sao.common.download_file(
                csv, this.name + '.csv', {type: 'text/csv;charset=utf-8'});
            return Sao.common.message.run(
                Sao.i18n.ngettext('%1 record saved', '%1 records saved',
                    data.length));
        },
        set_url: function() {
            var path = [this.session.database, 'data', this.screen.model_name];
            var query_string = [];
            var domain;
            if (JSON.parse(this.selected_records.val())) {
                domain = this.screen.current_view.selected_records.map(function(r) {
                    return r.id;
                });
            } else {
                domain = this.screen.search_domain(
                    this.screen.screen_container.get_text());
                if (!this.ignore_search_limit.prop('checked')) {
                    query_string.push(['s', this.screen.limit.toString()]);
                    query_string.push(
                        ['p', Math.floor(
                            this.screen.offset / this.screen.limit).toString()]);
                }
                if (this.screen.order) {
                    this.screen.order.forEach(function(expr) {
                        query_string.push(['o', expr.map(function(e) {
                            return e;
                        }).join(',')]);
                    });
                }
            }
            query_string.splice(
                0, 0, ['d', JSON.stringify(Sao.rpc.prepareObject(domain))]);
            if (!jQuery.isEmptyObject(this.screen.local_context)) {
                query_string.push(
                    ['c', JSON.stringify(Sao.rpc.prepareObject(
                        this.screen.local_context))]);
            }

            this.fields_selected.children('li').each(function(i, field) {
                query_string.push(['f', field.getAttribute('path')]);
            });

            query_string.push(['dl', this.el_csv_delimiter.val()]);
            query_string.push(['qc', this.el_csv_quotechar.val()]);

            if (!this.el_add_field_names.is(':checked')) {
                query_string.push(['h', '0']);
            }
            if (this.el_csv_locale.prop('checked')) {
                query_string.push(['loc', '1']);
            }

            query_string = query_string.map(function(param) {
                return param.map(encodeURIComponent).join('=');
            }).join('&');
            this.button_url.attr('href', '/' + path.join('/') + '?' + query_string);
        },
    });

    Sao.Window.Export.format_row = function(line, locale_format) {
        if (locale_format === undefined) {
            locale_format = true;
        }
        var row = [];
        line.forEach(function(val) {
            if (locale_format) {
                if (val.isDateTime) {
                    val = val.format(
                        Sao.common.date_format() + ' ' +
                        Sao.common.moment_format('%X'));
                } else if (val.isDate) {
                    val = val.format(Sao.common.date_format());
                } else if (val.isTimeDelta) {
                    val = Sao.common.timedelta.format(
                        val, {'s': 1, 'm': 60, 'h': 60 * 60});
                } else if (!isNaN(Number(val))) {
                    val = val.toLocaleString(
                        Sao.i18n.BC47(Sao.i18n.getlang()));
                }
            } else if (val.isTimeDelta) {
                val = val.asSeconds();
            } else if (typeof(val) == 'boolean') {
                val += 0;
            }
            row.push(val);
        });
        return row;
    };

    Sao.Window.EmailEntry = Sao.class_(Sao.common.InputCompletion, {
        init: function(el, session) {
            this.session = session;
            Sao.Window.EmailEntry._super.init.call(
                this, el,
                this._email_source,
                this._email_match_selected,
                this._email_format);
        },
        _email_match_selected: function(value) {
            this.input.val(value[2]);
        },
        _email_source: function(text) {
            if (this.input[0].selectionStart < this.input.val().length) {
                return jQuery.when([]);
            }
            return Sao.rpc({
                'method': 'model.ir.email.complete',
                'params': [text, Sao.config.limit, {}],
            }, this.session);
        },
        _email_format: function(value) {
            return value[1];
        },
    });

    Sao.Window.Email = Sao.class_(Object, {
        init: function(name, record, prints, template) {
            this.record = record;
            this.dialog = new Sao.Dialog(
                Sao.i18n.gettext('E-mail %1', name), 'email', 'lg');
            this.el = this.dialog.modal;
            this.dialog.content.addClass('form-horizontal');

            var body = this.dialog.body;
            function add_group(name, label, required) {
                var group = jQuery('<div/>', {
                    'class': 'form-group',
                }).appendTo(body);
                jQuery('<label/>', {
                    'class': 'control-label col-sm-1',
                    'text': label,
                    'for': 'email-' + name,
                }).appendTo(group);
                var input = jQuery('<input/>', {
                    'type': 'text',
                    'class':'form-control input-sm',
                    'id': 'email-' + name,
                }).appendTo(jQuery('<div/>', {
                    'class': 'col-sm-11',
                }).appendTo(group));
                if (required) {
                    input.attr('required', true);
                }
                return input;
            }

            this.to = add_group('to', Sao.i18n.gettext('To:'), true);
            this.cc = add_group('cc', Sao.i18n.gettext('Cc:'));
            this.bcc = add_group('bcc', Sao.i18n.gettext('Bcc:'));
            [this.to, this.cc, this.bcc].forEach(function(input) {
                new Sao.Window.EmailEntry(input, this.record.model.session);
            }.bind(this));
            this.subject = add_group(
                'subject', Sao.i18n.gettext('Subject:'), true);

            var panel = jQuery('<div/>', {
                'class': 'panel panel-default',
            }).appendTo(body
            ).append(jQuery('<div/>', {
                'class': 'panel-heading',
            }).append(Sao.common.richtext_toolbar()));
            this.body = jQuery('<div>', {
                'class': 'email-richtext form-control input-sm mousetrap',
                'contenteditable': true,
                'spellcheck': true,
                'id': 'email-body',
            }).appendTo(jQuery('<div/>', {
                'class': 'panel-body',
            }).appendTo(panel));

            var print_frame = jQuery('<div/>', {
                'class': 'col-md-6',
            }).appendTo(body);
            jQuery('<label/>', {
                'text': Sao.i18n.gettext("Reports"),
            }).appendTo(print_frame);
            this.print_actions = {};
            for (var i = 0; i < prints.length; i++) {
                var print = prints[i];
                var print_check = jQuery('<input/>', {
                    'type': 'checkbox',
                });
                jQuery('<div/>', {
                    'class': 'checkbox',
                }).append(jQuery('<label/>'
                ).text(Sao.i18n.gettext(print.name)
                ).prepend(print_check)).appendTo(print_frame);
                this.print_actions[print.id] = print_check;
            }

            this.files = jQuery('<div/>', {
                'class': 'col-md-6',
            }).appendTo(body);
            jQuery('<label/>', {
                'text': Sao.i18n.gettext("Attachments"),
            }).appendTo(this.files);
            this._add_file_button();

            jQuery('<button/>', {
                'class': 'btn btn-link',
                'type': 'button',
            }).text(' ' + Sao.i18n.gettext('Cancel')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-cancel')
            ).click(function() {
                this.response('RESPONSE_CANCEL');
            }.bind(this)).appendTo(this.dialog.footer);

            jQuery('<button/>', {
                'class': 'btn btn-primary',
                'type': 'submit',
            }).text(' ' + Sao.i18n.gettext('Send')).prepend(
                Sao.common.ICONFACTORY.get_icon_img('tryton-send')
            ).appendTo(this.dialog.footer);
            this.dialog.content.submit(function(e) {
                e.preventDefault();
                this.response('RESPONSE_OK');
            }.bind(this));

            this._fill_with(template);

            this.el.modal('show');
            this.el.on('hidden.bs.modal', function() {
                jQuery(this).remove();
            });
        },
        _add_file_button: function() {
            var row = jQuery('<div/>').appendTo(this.files);
            var file = jQuery('<input/>', {
                'type': 'file',
            }).appendTo(row);
            var button = jQuery('<a/>', {
                'class': 'close',
                'title': Sao.i18n.gettext("Remove attachment"),
            }).append(jQuery('<span/>', {
                'aria-hidden': true,
                'text': 'x',
            })).append(jQuery('<span/>', {
                'class': 'sr-only',
            }).text(Sao.i18n.gettext("Remove")));
            button.hide();
            button.appendTo(row);

            file.on('change', function() {
                button.show();
                this._add_file_button();
            }.bind(this));
            button.click(function() {
                row.remove();
            });
        },
        get_files: function() {
            var prms = [];
            var files = [];
            this.files.find('input[type=file]').each(function(i, input) {
                if (input.files.length) {
                    var dfd = jQuery.Deferred();
                    prms.push(dfd);
                    Sao.common.get_file_data(
                        input.files[0], function(data, filename) {
                            files.push([filename, data]);
                            dfd.resolve();
                        });
                }
            });
            return jQuery.when.apply(jQuery, prms).then(function() {
                return files;
            });
        },
        _fill_with: function(template) {
            var prm;
            if (template) {
                prm = Sao.rpc({
                    'method': 'model.ir.email.template.get',
                    'params': [template, this.record.id, {}],
                }, this.record.model.session);
            } else {
                prm = Sao.rpc({
                    'method': 'model.ir.email.template.get_default',
                    'params': [this.record.model.name, this.record.id, {}],
                }, this.record.model.session);
            }
            prm.then(function(values) {
                this.to.val((values.to || []).join(', '));
                this.cc.val((values.cc || []).join(', '));
                this.bcc.val((values.bcc || []).join(', '));
                this.subject.val(values.subject || '');
                this.body.html(Sao.HtmlSanitizer.sanitize(values.body || ''));
                var print_ids = (values.reports || []);
                for (var print_id in this.print_actions) {
                    var check = this.print_actions[print_id];
                    check.prop(
                        'checked', ~print_ids.indexOf(parseInt(print_id, 10)));
                }
            }.bind(this));
        },
        response: function(response_id) {
            if (response_id == 'RESPONSE_OK') {
                var to = this.to.val();
                var cc = this.cc.val();
                var bcc = this.bcc.val();
                var subject = this.subject.val();
                var body = Sao.common.richtext_normalize(this.body.html());
                var reports = [];
                for (var id in this.print_actions) {
                    var check = this.print_actions[id];
                    if (check.prop('checked')) {
                        reports.push(id);
                    }
                }
                var record = this.record;
                this.get_files().then(function(attachments) {
                    return Sao.rpc({
                        'method': 'model.ir.email.send',
                        'params': [
                            to, cc, bcc, subject, body,
                            attachments,
                            [record.model.name, record.id],
                            reports, {}],
                    }, record.model.session);
                }).then(function() {
                    this.destroy();
                }.bind(this));
            } else {
                this.destroy();
            }
        },
        destroy: function() {
            this.el.modal('hide');
        },
    });

}());
