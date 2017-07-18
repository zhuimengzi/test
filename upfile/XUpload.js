;(function (w, doc) {
    // 构造器
    function XUpload (el, options) {
        switch (typeof el) {
            case 'string':
                el = document.getElementById(el.substr(1));
                break;
            case 'object':
                if (el.jquery) {
                    el = el[0];
                }
                break;
        }

        this._el = options.el = options.el || el;
        this._options = options;
        this._input = null;
        this.checkSuccessFile = [];
        this.files = [];

        this._init();
    }

    // 判断类型
    XUpload.type = function (obj) {
        var typeStr = Object.prototype.toString.call(obj);
        return typeStr.slice(typeStr.indexOf(' ') + 1, -1);
    };

    // 插件扩展
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
            console.error('参数只支持传递对象');
        }
        else {
            if (len === 1) {
                extend(this, arg[0]);
            }
            else{
                extend(arg[0], arg[1]);
            }
        }
    };

    // 扩展静态属性方法
    XUpload.extend({
        // 插件名称
        name: 'XUpload',
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
        }
    });

    // 扩展原型属性方法
    XUpload.prototype.extend({
        // 获取一个唯一的id
        _getUID: function () {
            var uid = 0;

            return function () {
                return XUpload.name + (++uid);
            };
        }(),

        // 初始化
        _init: function () {
            var input = this._createInput();

            XUpload.addEvent(this._el, 'click', function () {
                input.click();
            });
        },

        // 创建input
        _createInput: function () {
            var _this = this;

            this._input = doc.body.appendChild(
                XUpload.createEl('input', {
                    type: 'file',
                    multiple: 'multiple',
                    name: this._options.name || 'filename'
                }, {
                    display: 'none'
                })
            );

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
                    _this._options.onChange && _this._options.onChange.call(this, _this.files);

                    if (_this._checkFile().length) {
                        _this._options.checkSuccess && _this._options.checkSuccess.call(this, _this.checkSuccessFile);
                    }

                    if (_this._options.autoSubmit) {
                        _this.submit();
                    }
                }
            });

            return this._input;
        },

        // 创建form
        _createForm: function (iframe) {
            var options = this._options;

            var form = XUpload.createEl(
                '<form method="post" enctype="multipart/form-data"></form>',
                {
                    action: options.url,
                },
                {
                    display: 'none'
                }
            );

            if (iframe) {
                form.target = iframe.name;
            }

            var key = null;
            var data = options.data;
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
            var uid = this._getUID();

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
        },

        // iframe提交数据
        _iframeSubmit: function () {
            var _this = this;
            var form = null;
            var iframe = null;

            form = this._createForm(iframe = this._createIframe());
            form.appendChild(this._input);

            XUpload.addEvent(iframe, 'load', function () {
                var doc = iframe.contentDocument ? iframe.contentDocument : frames[iframe.id].document;
                var response = doc;

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

                    if (_this._options.responseType && _this._options.responseType.toLowerCase() === 'json'){

                        if (doc.body.firstChild && doc.body.firstChild.nodeName.toUpperCase() === 'PRE'){
                            response = new Function('return ' + doc.body.firstChild.firstChild.nodeValue)();
                        }
                        else {
                            response = {};
                        }
                    }
                }

                _this._options.onSuccess.call(this, response);

                // 清理
                iframe.parentNode.removeChild(iframe);
                form.parentNode.removeChild(form);
                iframe = null;
                form = null;
            });

            form.submit();
        },

        // ajax提交数据
        _ajaxSubmit: function () {
            var _this = this;
            var options = this._options;
            var form = null;
            var formData = null;

            form = this._createForm();
            form.appendChild(this._input);
            formData = new FormData();

            for (var i = 0, len = this.checkSuccessFile.length; i < len; i++) {
                formData.append(options.name || 'filename', this.checkSuccessFile[i]);
            }

            if (options.data) {
                for (var key in options.data) {
                    formData.append(key, options.data[key]);
                }
            }

            var xhr = new XMLHttpRequest();
            xhr.open('POST', options.url);
            xhr.upload.onprogress = function(e){
                options.onProgress && options.onProgress.call(this, e.loaded, e.total);
            };
            xhr.onreadystatechange = function(){
                var result = null;
                if (this.readyState === 4 && this.status === 200) {
                    if (options.responseType.toLowerCase() === 'json') {
                        result = JSON.parse(this.response);
                    }
                    options.onSuccess && options.onSuccess.call(this, result || this.response);

                    // 清理
                    form.parentNode.removeChild(form);
                    form = null;
                }
                else if (this.status !== 200) {
                    if (options.responseType.toLowerCase() === 'json') {
                        result = JSON.parse(this.response);
                    }

                    options.onError && options.onError.call(this, result || this.response);

                    // 清理
                    form.parentNode.removeChild(form);
                    form = null;
                }
            };
            xhr.send(formData);
        },

        // 过滤文件后缀
        _checkFileType: function () {
            var files = this.files;
            var options = this._options;
            var fileType = options.fileType;
            var result = {
                error: [],
                success: []
            };
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
                if (files[i].size != undefined && files[i].size > this._options.maxSize) {
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
            return fileLen <= this._options.maxFileNum;
        },

        // 效验文件是否符合规格
        _checkFile: function () {
            var options = this._options;
            var checkFileType = this._checkFileType();
            var checkFileSize = this._checkFileSize();

            // 判断文件是否符合规则
            if ((checkFileType.error.length === 0 || (!options.strict && checkFileType.success.length > 0))
                && (checkFileSize.error.length === 0 || (!options.strict && checkFileSize.success.length > 0))
            ) {
                // 效验文件数量
                if (this._checkFileNum(checkFileType.success.length)) {
                    return this.checkSuccessFile = checkFileType.success;
                }
                else {
                    options.checkError && options.checkError.call(this, {
                        fileLen: checkFileType.success.length
                    });

                    return [];
                }
            }
            else {
                // 文件类型或文件大小不符合规范
                options.checkError && options.checkError.call(this, {
                    exceedFileSize: checkFileSize.error,
                    formatError: checkFileType.error
                });

                return [];
            }
        },

        // 根据浏览器兼容性来确定提交数据的方式
        _pushData: function () {
            // 判断是否支持ajax提交文件
            if (!typeof FormData === 'function') {
                this._ajaxSubmit();
            }
            else {
                this._iframeSubmit();
            }
        },

        // 提交数据入口,会做一些判断来确定是否要提交
        submit: function () {
            var options = this._options;

            // 判断是否有效验成功的文件
            if (this.checkSuccessFile.length > 0) {
                // 如果onSubmit返回false则不执行提交文件
                if (!options.onSubmit || (options.onSubmit && options.onSubmit.call(this, this.files) !== false)) {
                    this._pushData();
                }
            }
        }
    });

    // 暴露方法
    w.XUpload = XUpload;
}(window, document));