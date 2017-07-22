;(function (global, fn) {
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = global.document ? fn(global, document) : function (w) {
            if (!w.document) {
                throw new Error('请在浏览器中运行此脚本');
            }
            else {
                return fn(global, global.document);
            }
        }
    }
    else {
        fn(global, document);
    }
}(typeof window !== 'undefined' ? window : this, function (global, doc) {
    var _XUpload = global.XUpload;

    // _init才是真正的构造器
    var XUpload = function (config) {
        // 这样做的目的是可以实现new XUpload() 和 XUpload()两种调用方式
        return new XUpload.prototype._init(config);
    };

    // 判断类型
    XUpload.type = function (obj) {
        var typeStr = Object.prototype.toString.call(obj);
        return typeStr.slice(typeStr.indexOf(' ') + 1, -1);
    };

    // 对象扩展
    XUpload.prototype.extend = XUpload.extend = function () {
        var arg = arguments;
        var len = arg.length;

        function extend (source, target) {
            for (var key in target) {
                if (target.hasOwnProperty(key)) {
                    source[key] = target[key];
                }
            }

            return source;
        }

        if (typeof arg[0] !== 'object' || (arg[1] && typeof arg[1] !== 'object')) {
            throw new Error('参数只支持传递对象');
        }
        else {
            if (len === 1) {
                arg[1] = arg[0];
                arg[0] = this;
            }

            return extend(arg[0], arg[1]);
        }
    };

    // 扩展静态属性方法
    XUpload.extend({
        // 插件名称
        name: 'XUpload',
        // 插件版本
        version: '1.0',
        // 获取一个唯一的id
        _getUID: function () {
            var uid = 0;

            return function () {
                return XUpload.name + (++uid);
            };
        }(),
        // 添加事件
        addEvent: function (el, type, fn) {
            if (el.addEventListener) {
                el.addEventListener(type, fn, false);
            }
            else if (el.attachEvent) {
                el.attachEvent.call(el, 'on' + type, fn);
            }
        },
        // 创建元素
        createEl: function (elStr, props, styles) {
            var el = null;
            var div = null;

            if (XUpload.trim(elStr).slice(0, 1) === '<') {
                div = doc.createElement('div');
                div.innerHTML = elStr;
                el = div.children[0];

                if (div.parentNode) {
                    div.parentNode.removeChild(div);
                }

                div = null;
            }
            else {
                el = doc.createElement(elStr);
            }

            for (var key in props) {
                if (props.hasOwnProperty(key)) {
                    el.setAttribute(key, props[key]);
                }
            }

            if (styles) {
                XUpload.extend(el.style, styles);
            }

            return el;
        },
        // 去除首尾空格
        trim: function (str) {
            return str.replace(/^\s*|\s*$/g, '');
        },
        // 获取文件后缀
        ext: function (fileName) {
            return fileName.slice(fileName.lastIndexOf('.') + 1);
        },
        // 抛出错误
        error: function (text){
            if (console) {
                console.error(text);
            }
            else {
                throw new Error(text);
            }
        }
    });

    // 入口
    XUpload.prototype.extend({
        // 构造器
        _init: function (config) {
            // 修正el
            switch (typeof config.el) {
                case 'string':
                    config.el = document.getElementById(config.el.substr(1));
                    break;
                case 'object':
                    if (config.el.jquery) {
                        config.el = config.el[0];
                    }
                    break;
            }

            // 合并默认配置和用户配置
            this._config = XUpload.extend(
                {
                    el: '',
                    url: '',
                    name: 'filename',
                    autoSubmit: false,
                    data: {},
                    fileType: [],
                    maxSize: 9999999999999,
                    maxFileNum: 100,
                    // 最大响应时间,毫秒
                    maxResponseTime: 10000,
                    // 每次上传的数量,0为不限制
                    eachQuantity: 0,
                    // 严格模式
                    strict: false,
                    // 返回类型
                    responseType: '',
                    // 扩展方法
                    $extend: {},
                    checkError: function () {},
                    checkSuccess: function () {},
                    onChange: function () {},
                    onSubmit: function () {},
                    onProgress: function () {},
                    onSuccess: function () {},
                    onError: function () {}
                },
                config
            );

            this.extend(this._config.$extend);

            this._input = null;
            this.checkSuccessFile = [];
            this.files = [];
            // 请求完成
            this.complete = false;

            this._render();
        },

        // 渲染
        _render: function () {
            var input = this._createInput();

            XUpload.addEvent(this._config.el, 'click', function () {
                input.click();
            });
        }
    });

    // 创建所需的元素
    XUpload.prototype.extend({
        // 创建input
        _createInput: function () {
            var _this = this;

            this._input = doc.body.appendChild(
                XUpload.createEl('input', {
                    type: 'file',
                    multiple: 'multiple',
                    name: this._config.name
                }, {
                    display: 'none'
                })
            );

            if (!this._input.files) {
                this._input.removeAttribute('multiple');
            }

            XUpload.addEvent(this._input, 'change', function () {
                if (this.files) {
                    _this.files = [].slice.call(this.files);
                }
                else {
                    _this.files = [{
                        name: this.value
                    }];
                }

                if (_this.files.length > 0) {
                    _this._config.onChange.call(this, _this.files);

                    if (_this._checkFile().length) {
                        _this._config.checkSuccess.call(_this, _this.checkSuccessFile);

                        if (_this._config.autoSubmit) {
                            _this.submit();
                        }
                    }
                }
            });

            return this._input;
        },

        // 创建form
        _createForm: function (iframe) {
            var config = this._config;

            var form = XUpload.createEl(
                '<form method="post" enctype="multipart/form-data"></form>',
                {
                    action: config.url
                },
                {
                    display: 'none'
                }
            );

            if (iframe) {
                form.target = iframe.name;
            }

            var key = null;
            var data = config.data;
            if (data) {
                for (key in data) {
                    form.appendChild(
                        XUpload.createEl('input', {
                            type: 'hidden',
                            name: key,
                            value: data[key]
                        })
                    );
                }
            }

            return this._form = doc.body.appendChild(form);
        },

        // 创建iframe
        _createIframe: function () {
            var uid = XUpload._getUID();

            return doc.body.appendChild(
                XUpload.createEl(
                    '<iframe src="javascript:false;" name="'+ uid +'"></iframe>',
                    {
                        id: uid
                    },
                    {
                        display: 'none'
                    }
                )
            );
        }
    });

    // 对超出最大响应时间进行处理
    XUpload.prototype.extend({
        _testMaxResponseTime: function () {
            var _this = this;
            var maxResponseTime = this._config.maxResponseTime;

            setTimeout(
                function () {
                    if (!_this.complete) {
                        _this._error(0);
                    }
                },
                maxResponseTime
            );
        }
    });

    // 针对浏览器兼容性使用不同的提交方式
    XUpload.prototype.extend({
        // 提交数据入口,会做一些判断来确定是否要提交
        submit: function () {
            var config = this._config;

            // 如果onSubmit返回false则不执行提交文件
            if (config.onSubmit.call(this, this.checkSuccessFile, this.files) !== false) {
                this.complete = false;

                this._submit();
                this._testMaxResponseTime();
            }
        },

        // 根据浏览器兼容性来确定提交数据的方式
        _submit: function () {
            // 判断是否支持ajax提交文件
            if (typeof FormData === 'function') {
                this._ajaxSubmit();
            }
            else {
                this._iframeSubmit();
            }
        },

        // iframe提交数据
        _iframeSubmit: function () {
            var _this = this;
            var form = null;
            var iframe = null;

            form = this._createForm(iframe = this._createIframe());
            form.appendChild(this._input);

            XUpload.addEvent(iframe, 'load', function () {
                _this._complete();

                // 清理
                if (_this.complete && form) {
                    iframe.parentNode.removeChild(iframe);
                    form.parentNode.removeChild(form);
                    iframe = null;
                    form = null;
                }
            });

            XUpload.addEvent(iframe, 'error', function () {
                _this._error(-1);

                // 清理
                if (_this.complete) {
                    iframe.parentNode.removeChild(iframe);
                    form.parentNode.removeChild(form);
                    iframe = null;
                    form = null;
                }
            });

            form.submit();
        },

        // ajax提交数据
        _ajaxSubmit: function () {
            var data = this._eachQuantity();

            if (data.state === 1) {
                return;
            }

            var _this = this;
            var config = this._config;
            var form = data.form;
            var formData = data.formData;

            var xhr = new XMLHttpRequest();
            xhr.open('POST', config.url);
            xhr.onerror = function () {
                _this.error(-1);
            };
            xhr.upload.onprogress = function(e){
                config.onProgress.call(_this, e.loaded, e.total);
            };
            xhr.onreadystatechange = function(){
                _this._complete(this);

                // 清理
                if (_this.complete && form) {
                    form.parentNode.removeChild(form);
                    form = null;
                }
            };
            xhr.send(formData);

            // 递归,针对分次上传处理
            data.state !== undefined && this._ajaxSubmit();
        },

        // 对每次上传的数量进行处理
        _eachQuantity: function () {
            var index = 0;

            return function () {
                var config = this._config;
                var form = null;
                var formData = null;
                var i = 0;
                var len = 0;

                form = this._createForm();
                form.appendChild(this._input);
                formData = new FormData();

                if (config.data) {
                    for (var key in config.data) {
                        formData.append(key, config.data[key]);
                    }
                }

                if (config.eachQuantity > 0) {
                    if (index < this.checkSuccessFile.length) {
                        for (i = 0; i < config.eachQuantity; index++, i++) {
                            formData.append(config.name, this.checkSuccessFile[index]);
                        }

                        return {
                            form: form,
                            formData: formData,
                            state: 0
                        };
                    }
                    else {
                        return {
                            state: 1
                        };
                    }
                }
                else {
                    for (i = 0, len = this.checkSuccessFile.length; i < len; i++) {
                        formData.append(config.name, this.checkSuccessFile[i]);
                    }

                    return {
                        form: form,
                        formData: formData
                    };
                }
            };
        }()
    });

    // 对请求结果进行处理
    XUpload.prototype.extend({
        // 请求完成
        _complete: function (obj) {
            var doc = null;
            var response = null;

            // 针对iframe的请求
            if (obj.src) {
                doc = obj.contentDocument ? obj.contentDocument : obj[obj.id].document;
                response = doc;

                // 判断页面是否加载成功
                if ((doc.readyState && doc.readyState !== 'complete')
                    || (doc.body && doc.body.innerHTML === 'false')) {
                    return;
                }

                // 判断是不是XML,如果是则返回XML,否则判断返回的是文本还是json
                if (doc.XMLDocument) {
                    response = doc.XMLDocument;
                }
                else if (doc.body) {
                    response = doc.body.innerHTML;

                    // json
                    if (this._config.responseType.toLowerCase() === 'json'){

                        if (doc.body.firstChild){
                            response = new Function('return ' + doc.body.firstChild.nodeValue)();
                        }
                        else {
                            response = {};
                        }
                    }
                }

                this._success(response);
            }
            // 针对ajax
            else {
                if (obj.readyState === 4 && obj.status === 200) {
                    if (this._config.responseType.toLowerCase() === 'json') {
                        response = JSON.parse(obj.response);
                    }

                    this._success(response || obj.response);
                }
                else if (obj.status !== 200) {
                    this._error(1);
                }
            }
        },

        // 请求成功
        _success: function (response) {
            this.complete = true;
            this._config.onSuccess.call(
                this, response, this.checkSuccessFile, this.files
            );
        },

        // 请求失败
        _error: function (type) {
            this.complete = true;
            this._config.onError.call(this, type);
        }
    });

    // 效验文件
    XUpload.prototype.extend({
        // 效验文件是否符合规格
        _checkFile: function () {
            var config = this._config;
            var checkFileType = this._checkFileType();
            var checkFileSize = this._checkFileSize();

            // 判断文件是否符合规则
            if ((checkFileType.error.length === 0 || (!config.strict && checkFileType.success.length > 0))
                && (checkFileSize.error.length === 0 || (!config.strict && checkFileSize.success.length > 0))
            ) {
                // 效验文件数量
                if (this._checkFileNum(checkFileType.success.length)) {
                    return this.checkSuccessFile = checkFileType.success;
                }
                else {
                    config.checkError.call(this, {
                        fileLen: checkFileType.success.length
                    });

                    return [];
                }
            }
            else {
                // 文件类型或文件大小不符合规范
                config.checkError.call(this, {
                    exceedFileSize: checkFileSize.error,
                    formatError: checkFileType.error
                });

                return [];
            }
        },

        // 过滤文件后缀
        _checkFileType: function () {
            var files = this.files;
            var config = this._config;
            var fileType = config.fileType;
            var result = {
                error: [],
                success: []
            };

            if (fileType.length <= 0) {
                result.success = files;

                return result;
            }

            for (var i = 0, len = files.length; i < len; i++) {
                for (var j = 0, len2 = fileType.length; j < len2; j++) {
                    if (XUpload.ext(files[i].name) === fileType[j]) {
                        result.success.push(files[i]);
                    }
                    else if (j === len2 - 1) {
                        result.error.push(files[i]);
                    }
                }
            }
            return result;
        },

        // 效验文件大小
        _checkFileSize: function () {
            var files = this.files;
            var result = {
                error: [],
                success: []
            };

            for (var i = 0, len = files.length; i < len; i++) {
                if (files[i].size > this._config.maxSize) {
                    result.error.push(files[i]);
                }
                else {
                    result.success.push(files[i]);
                }
            }
            return result;
        },

        // 效验文件数量
        _checkFileNum: function (fileLen) {
            return fileLen <= this._config.maxFileNum;
        }
    });

    // 修正原型指向
    XUpload.prototype._init.prototype = XUpload.prototype;

    // 判断是否支持amd,如果支持则使用amd规范
    if (typeof define === "function" && define.amd) {
        define([], function () {
            return  XUpload;
        });
    }
    else {
        // 解决命名冲突
        if (_XUpload) {
            global.$XUpload = XUpload;
            global.XUpload = _XUpload;

            XUpload.error('XUpload存在命名冲突,请使用$XUpload来代替XUpload,如您已更换到$XUpload则可以忽略本条信息');
        }
        else {
            global.XUpload = XUpload;
        }

    }

    return XUpload;
}));
