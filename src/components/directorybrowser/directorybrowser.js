define(['loading', 'dialogHelper', 'dom', 'globalize', 'listViewStyle', 'emby-input', 'paper-icon-button-light', 'css!./directorybrowser', 'formDialogStyle', 'emby-button'], function(loading, dialogHelper, dom, globalize) {
    'use strict';

    function getSystemInfo() {
        return systemInfo ? Promise.resolve(systemInfo) : ApiClient.getPublicSystemInfo().then(
            function(info) {
                systemInfo = info;
                return info;
            }
        );
    }

    function onDialogClosed() {
        loading.hide();
    }

    function refreshDirectoryBrowser(page, path, fileOptions, updatePathOnError) {
        if (path && typeof path !== 'string') {
            throw new Error('invalid path');
        }

        loading.show();

        var promises = [];

        if ('Network' === path) {
            promises.push(ApiClient.getNetworkDevices());
        } else {
            if (path) {
                promises.push(ApiClient.getDirectoryContents(path, fileOptions));
                promises.push(ApiClient.getParentPath(path));
            } else {
                promises.push(ApiClient.getDrives());
            }
        }

        Promise.all(promises).then(
            function(responses) {
                var folders = responses[0];
                var parentPath = responses[1] || '';
                var html = '';

                page.querySelector('.results').scrollTop = 0;
                page.querySelector('#txtDirectoryPickerPath').value = path || '';

                if (path) {
                    html += getItem('lnkPath lnkDirectory', '', parentPath, '...');
                }
                for (var i = 0, length = folders.length; i < length; i++) {
                    var folder = folders[i];
                    var cssClass = 'File' === folder.Type ? 'lnkPath lnkFile' : 'lnkPath lnkDirectory';
                    html += getItem(cssClass, folder.Type, folder.Path, folder.Name);
                }

                if (!path) {
                    html += getItem('lnkPath lnkDirectory', '', 'Network', globalize.translate('ButtonNetwork'));
                }

                page.querySelector('.results').innerHTML = html;
                loading.hide();
            }, function() {
                if (updatePathOnError) {
                    page.querySelector('#txtDirectoryPickerPath').value = '';
                    page.querySelector('.results').innerHTML = '';
                    loading.hide();
                }
            }
        );
    }

    function getItem(cssClass, type, path, name) {
        var html = '';
        html += '<div class="listItem listItem-border ' + cssClass + '" data-type="' + type + '" data-path="' + path + '">';
        html += '<div class="listItemBody" style="padding-left:0;padding-top:.5em;padding-bottom:.5em;">';
        html += '<div class="listItemBodyText">';
        html += name;
        html += '</div>';
        html += '</div>';
        html += '<span class="material-icons arrow_forward" style="font-size:inherit;"></span>';
        html += '</div>';
        return html;
    }

    function getEditorHtml(options, systemInfo) {
        var html = '';
        html += '<div class="formDialogContent scrollY">';
        html += '<div class="dialogContentInner dialog-content-centered" style="padding-top:2em;">';
        if (!options.pathReadOnly) {
            var instruction = options.instruction ? options.instruction + '<br/><br/>' : '';
            html += '<div class="infoBanner" style="margin-bottom:1.5em;">';
            html += instruction;
            if ('bsd' === systemInfo.OperatingSystem.toLowerCase()) {
                html += '<br/>';
                html += '<br/>';
                html += globalize.translate('MessageDirectoryPickerBSDInstruction');
                html += '<br/>';
            } else if ('linux' === systemInfo.OperatingSystem.toLowerCase()) {
                html += '<br/>';
                html += '<br/>';
                html += globalize.translate('MessageDirectoryPickerLinuxInstruction');
                html += '<br/>';
            }
            html += '</div>';
        }
        html += '<form style="margin:auto;">';
        html += '<div class="inputContainer" style="display: flex; align-items: center;">';
        html += '<div style="flex-grow:1;">';
        var labelKey;
        if (options.includeFiles !== true) {
            labelKey = 'LabelFolder';
        } else {
            labelKey = 'LabelPath';
        }
        var readOnlyAttribute = options.pathReadOnly ? ' readonly' : '';
        html += '<input is="emby-input" id="txtDirectoryPickerPath" type="text" required="required" ' + readOnlyAttribute + ' label="' + globalize.translate(labelKey) + '"/>';
        html += '</div>';
        if (!readOnlyAttribute) {
            html += '<button type="button" is="paper-icon-button-light" class="btnRefreshDirectories emby-input-iconbutton" title="' + globalize.translate('ButtonRefresh') + '"><span class="material-icons search"></span></button>';
        }
        html += '</div>';
        if (!readOnlyAttribute) {
            html += '<div class="results paperList" style="max-height: 200px; overflow-y: auto;"></div>';
        }
        if (options.enableNetworkSharePath) {
            html += '<div class="inputContainer" style="margin-top:2em;">';
            html += '<input is="emby-input" id="txtNetworkPath" type="text" label="' + globalize.translate('LabelOptionalNetworkPath') + '"/>';
            html += '<div class="fieldDescription">';
            html += globalize.translate('LabelOptionalNetworkPathHelp', '<b>\\\\server</b>', '<b>\\\\192.168.1.101</b>');
            html += '</div>';
            html += '</div>';
        }
        html += '<div class="formDialogFooter">';
        html += '<button is="emby-button" type="submit" class="raised button-submit block formDialogFooterItem">' + globalize.translate('ButtonOk') + '</button>';
        html += '</div>';
        html += '</form>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    function alertText(text) {
        alertTextWithOptions({
            text: text
        });
    }

    function alertTextWithOptions(options) {
        require(['alert'], function(alert) {
            alert(options);
        });
    }

    function validatePath(path, validateWriteable, apiClient) {
        return apiClient.ajax({
            type: 'POST',
            url: apiClient.getUrl('Environment/ValidatePath'),
            data: {
                ValidateWriteable: validateWriteable,
                Path: path
            }
        }).catch(function(response) {
            if (response) {
                if (response.status === 404) {
                    alertText(globalize.translate('PathNotFound'));
                    return Promise.reject();
                }
                if (response.status === 500) {
                    if (validateWriteable) {
                        alertText(globalize.translate('WriteAccessRequired'));
                    } else {
                        alertText(globalize.translate('PathNotFound'));
                    }
                    return Promise.reject();
                }
            }
            return Promise.resolve();
        });
    }

    function initEditor(content, options, fileOptions) {
        content.addEventListener('click', function(e) {
            var lnkPath = dom.parentWithClass(e.target, 'lnkPath');
            if (lnkPath) {
                var path = lnkPath.getAttribute('data-path');
                if (lnkPath.classList.contains('lnkFile')) {
                    content.querySelector('#txtDirectoryPickerPath').value = path;
                } else {
                    refreshDirectoryBrowser(content, path, fileOptions, true);
                }
            }
        });

        content.addEventListener('click', function(e) {
            if (dom.parentWithClass(e.target, 'btnRefreshDirectories')) {
                var path = content.querySelector('#txtDirectoryPickerPath').value;
                refreshDirectoryBrowser(content, path, fileOptions);
            }
        });

        content.addEventListener('change', function(e) {
            var txtDirectoryPickerPath = dom.parentWithTag(e.target, 'INPUT');
            if (txtDirectoryPickerPath && 'txtDirectoryPickerPath' === txtDirectoryPickerPath.id) {
                refreshDirectoryBrowser(content, txtDirectoryPickerPath.value, fileOptions);
            }
        });

        content.querySelector('form').addEventListener('submit', function(e) {
            if (options.callback) {
                var networkSharePath = this.querySelector('#txtNetworkPath');
                networkSharePath = networkSharePath ? networkSharePath.value : null;
                var path = this.querySelector('#txtDirectoryPickerPath').value;
                validatePath(path, options.validateWriteable, ApiClient).then(options.callback(path, networkSharePath));
            }
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }

    function getDefaultPath(options) {
        if (options.path) {
            return Promise.resolve(options.path);
        } else {
            return ApiClient.getJSON(ApiClient.getUrl('Environment/DefaultDirectoryBrowser')).then(
                function(result) {
                    return result.Path || '';
                }, function() {
                    return '';
                }
            );
        }
    }

    function directoryBrowser() {
        var currentDialog;
        var self = this;
        self.show = function(options) {
            options = options || {};
            var fileOptions = {
                includeDirectories: true
            };
            if (options.includeDirectories != null) {
                fileOptions.includeDirectories = options.includeDirectories;
            }
            if (options.includeFiles != null) {
                fileOptions.includeFiles = options.includeFiles;
            }
            Promise.all([getSystemInfo(), getDefaultPath(options)]).then(
                function(responses) {
                    var systemInfo = responses[0];
                    var initialPath = responses[1];
                    var dlg = dialogHelper.createDialog({
                        size: 'small',
                        removeOnClose: true,
                        scrollY: false
                    });
                    dlg.classList.add('ui-body-a');
                    dlg.classList.add('background-theme-a');
                    dlg.classList.add('directoryPicker');
                    dlg.classList.add('formDialog');

                    var html = '';
                    html += '<div class="formDialogHeader">';
                    html += '<button is="paper-icon-button-light" class="btnCloseDialog autoSize" tabindex="-1"><span class="material-icons arrow_back"></span></button>';
                    html += '<h3 class="formDialogHeaderTitle">';
                    html += options.header || globalize.translate('HeaderSelectPath');
                    html += '</h3>';
                    html += '</div>';
                    html += getEditorHtml(options, systemInfo);
                    dlg.innerHTML = html;
                    initEditor(dlg, options, fileOptions);
                    dlg.addEventListener('close', onDialogClosed);
                    dialogHelper.open(dlg);
                    dlg.querySelector('.btnCloseDialog').addEventListener('click', function() {
                        dialogHelper.close(dlg);
                    });
                    currentDialog = dlg;
                    dlg.querySelector('#txtDirectoryPickerPath').value = initialPath;
                    var txtNetworkPath = dlg.querySelector('#txtNetworkPath');
                    if (txtNetworkPath) {
                        txtNetworkPath.value = options.networkSharePath || '';
                    }
                    if (!options.pathReadOnly) {
                        refreshDirectoryBrowser(dlg, initialPath, fileOptions, true);
                    }
                }
            );
        };
        self.close = function() {
            if (currentDialog) {
                dialogHelper.close(currentDialog);
            }
        };
    }

    var systemInfo;
    return directoryBrowser;
});
