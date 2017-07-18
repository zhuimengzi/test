/**
 * Ajax upload
 * Project page - http://valums.com/ajax-upload/
 * Copyright (c) 2008 Andris Valums, http://valums.com
 * Licensed under the MIT license (http://valums.com/mit-license/)
 * Version 3.6 (26.06.2009)
 */

/**
 * Changes from the previous version:
 * 1. Fixed minor bug where click outside the button
 * would open the file browse window
 *
 * For the full changelog please visit:
 * http://valums.com/ajax-upload-changelog/
 */

(function(){
    // 简写
    var d = document, w = window;

    // 通过id获取元素
    function get(element){
        if (typeof element == "string")
            element = d.getElementById(element);
        return element;
    }

    // 绑定事件
    function addEvent(el, type, fn){
        if (w.addEventListener){
            el.addEventListener(type, fn, false);
        } else if (w.attachEvent){
            var f = function(){
                fn.call(el, w.event);
            };
            el.attachEvent('on' + type, f)
        }
    }

    // 将html字符串转dom
    var toElement = function(){
        var div = d.createElement('div');
        return function(html){
            div.innerHTML = html;
            var el = div.childNodes[0];
            div.removeChild(el);
            return el;
        }
    }();

    // 判断是否存在class
    function hasClass(ele,cls){
        return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
    }
    // 添加class
    function addClass(ele,cls) {
        if (!hasClass(ele,cls)) ele.className += " "+cls;
    }
    // 移除class
    function removeClass(ele,cls) {
        var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
        ele.className=ele.className.replace(reg,' ');
    }

    // 获取元素的top和left
    if (document.documentElement["getBoundingClientRect"]){
        // Get Offset using getBoundingClientRect
        // http://ejohn.org/blog/getboundingclientrect-is-awesome/
        var getOffset = function(el){
            var box = el.getBoundingClientRect(),
                doc = el.ownerDocument,
                body = doc.body,
                docElem = doc.documentElement,

                // ie
                clientTop = docElem.clientTop || body.clientTop || 0,
                clientLeft = docElem.clientLeft || body.clientLeft || 0,


                // 在Internet Explorer 7中，getBoundingClientRect属性被视为物理，
                // 使所有逻辑，像在IE8

                zoom = 1;
            if (body.getBoundingClientRect) {
                var bound = body.getBoundingClientRect();
                zoom = (bound.right - bound.left)/body.clientWidth;
            }
            if (zoom > 1){
                clientTop = 0;
                clientLeft = 0;
            }
            var top = box.top/zoom + (window.pageYOffset || docElem && docElem.scrollTop/zoom || body.scrollTop/zoom) - clientTop,
                left = box.left/zoom + (window.pageXOffset|| docElem && docElem.scrollLeft/zoom || body.scrollLeft/zoom) - clientLeft;

            return {
                top: top,
                left: left
            };
        }

    } else {
        // 判断是否使用了jquery,如果有则使用jquery的offset,否则使用元素的offsetTop,offsetLeft属性来获取,并递归父节点
        var getOffset = function(el){
            if (w.jQuery){
                return jQuery(el).offset();
            }

            var top = 0, left = 0;
            do {
                top += el.offsetTop || 0;
                left += el.offsetLeft || 0;
            }
            while (el = el.offsetParent);

            return {
                left: left,
                top: top
            };
        }
    }

    // 获取元素所在位置,left,right,top,bottom
    function getBox(el){
        var left, right, top, bottom;
        var offset = getOffset(el);
        left = offset.left;
        top = offset.top;

        right = left + el.offsetWidth;
        bottom = top + el.offsetHeight;

        return {
            left: left,
            right: right,
            top: top,
            bottom: bottom
        };
    }

    // 获取鼠标坐标
    function getMouseCoords(e){
        // pageX/Y is not supported in IE
        // http://www.quirksmode.org/dom/w3c_cssom.html
        if (!e.pageX && e.clientX){
            // In Internet Explorer 7 some properties (mouse coordinates) are treated as physical,
            // while others are logical (offset).
            var zoom = 1;
            var body = document.body;

            if (body.getBoundingClientRect) {
                var bound = body.getBoundingClientRect();
                zoom = (bound.right - bound.left)/body.clientWidth;
            }

            return {
                x: e.clientX / zoom + d.body.scrollLeft + d.documentElement.scrollLeft,
                y: e.clientY / zoom + d.body.scrollTop + d.documentElement.scrollTop
            };
        }

        return {
            x: e.pageX,
            y: e.pageY
        };

    }

    // 生成一个唯一id
    var getUID = function(){
        var id = 0;
        return function(){
            return 'ValumsAjaxUpload' + id++;
        }
    }();

    // 截取文件名
    function fileFromPath(file){
        return file.replace(/.*(\/|\\)/, "");
    }
    // 获取文件名后缀
    function getExt(file){
        return (/[.]/.exec(file)) ? /[^.]+$/.exec(file.toLowerCase()) : '';
    }

    // 入口
    Ajax_upload = AjaxUpload = function(button, options){

        // 如果是jquery对象,则将jquery对象转成dom
        if (button.jquery){
            button = button[0];
            // 判断button是不是一个以#开头的字符串,如果是则截取#号后面的内容
        } else if (typeof button == "string" && /^#.*/.test(button)){
            button = button.slice(1);
        }
        // 如果button是字符串则通过id获取元素,否则返回自身
        button = get(button);

        this._input = null;
        this._button = button;
        this._disabled = false;
        this._submitting = false;

        // 如果按钮被点击，变量更改为true
        this._justClicked = false;
        this._parentDialog = d.body;

        // 如果有使用jquery ui中的对话框组件则将_parentDialog值改为这个对话框元素
        if (window.jQuery && jQuery.ui && jQuery.ui.dialog){
            var parentDialog = jQuery(this._button).parents('.ui-dialog');
            if (parentDialog.length){
                this._parentDialog = parentDialog[0];
            }
        }

        // 默认配置
        this._settings = {
            // 上传地址
            action: 'upload.php',

            // 文件名
            name: 'userfile',

            // 需要传递的数据
            data: {},

            // 在文件被选中后立即提交
            autoSubmit: true,

            // 您期望从服务器返回的数据类型。
            // HTML (text) 和 XML 自动检测
            // 当您使用JSON作为响应时很实用，在这种情况下就设置为 “json”
            // 也要设置服务器端的响应类型为text/html, 否则在IE6下是不工作的
            responseType: false,

            // 文件选择后触发
            onChange: function(file, extension){},

            // 文件上传时触发
            // 您可以通过返回false取消上传
            onSubmit: function(file, extension){},

            // 文件上传完成的时触发
            onComplete: function(file, response) {}
        };

        // 用传递的参数覆盖默认配置
        for (var i in options) {
            this._settings[i] = options[i];
        }

        this._createInput();
        this._rerouteClicks();
    };
    // 给原型添加一些方法
    AjaxUpload.prototype = {
        // 设置数据
        setData : function(data){
            this._settings.data = data;
        },
        // 禁用上传
        disable : function(){
            this._disabled = true;
        },
        // 允许上传
        enable : function(){
            this._disabled = false;
        },
        // 清理ajaxupload对象
        destroy : function(){
            if(this._input){
                if(this._input.parentNode){
                    this._input.parentNode.removeChild(this._input);
                }
                this._input = null;
            }
        },

        // 创建一个不可见的input文件框
        _createInput : function(){
            var self = this;
            var input = d.createElement("input");
            input.setAttribute('type', 'file');
            input.setAttribute('multiple', 'multiple');
            input.setAttribute('name', this._settings.name);
            var styles = {
                'position' : 'absolute'
                ,'margin': '-5px 0 0 -175px'
                ,'padding': 0
                ,'width': '220px'
                ,'height': '30px'
                ,'fontSize': '14px'
                ,'opacity': 0
                ,'cursor': 'pointer'
                ,'display' : 'none'
                ,'zIndex' :  2147483583 //Max zIndex supported by Opera 9.0-9.2x
                // Strange, I expected 2147483647
            };
            for (var i in styles){
                input.style[i] = styles[i];
            }

            // 兼容IE
            if ( ! (input.style.opacity === "0")){
                input.style.filter = "alpha(opacity=0)";
            }

            this._parentDialog.appendChild(input);

            addEvent(input, 'change', function(){
                // 获取input文件名
                var file = fileFromPath(this.value);
                // 传递文件名和文件名后缀
                if(self._settings.onChange.call(self, file, getExt(file)) == false ){
                    return;
                }
                // 判断是否立即上传文件
                if (self._settings.autoSubmit){
                    self.submit();
                }
            });
            /*
              修复Safari的问题
              问题是如果在文件选择对话框打开之前离开输入
              它不会上传文件。
              当对话框缓慢打开（这是一个需要一些时间打开的工作表对话框）
              有一段时间你可以离开按钮。
              所以我们不应该立即将显示更改为none
            */
            addEvent(input, 'click', function(){
                self.justClicked = true;
                // 等待3秒钟打开对话框
                setTimeout(function(){
                    self.justClicked = false;
                }, 2500);
            });

            this._input = input;
        },

        // 当鼠标移动到button上时,将input定位到鼠标移动的那个位置,并显示
        _rerouteClicks : function (){
            var self = this;

            // IE displays 'access denied' error when using this method
            // other browsers just ignore click()
            // addEvent(this._button, 'click', function(e){
            //   self._input.click();
            // });

            var box, dialogOffset = {top:0, left:0}, over = false;

            addEvent(self._button, 'mouseover', function(e){
                if (!self._input || over) return;

                over = true;
                // 获取button所在位置
                box = getBox(self._button);

                if (self._parentDialog != d.body){
                    dialogOffset = getOffset(self._parentDialog);
                }
            });



            // 我们不能在按钮上使用mouseout，
            // 因为看不见的输入结束了
            addEvent(document, 'mousemove', function(e){
                var input = self._input;
                if (!input || !over) return;

                if (self._disabled){
                    removeClass(self._button, 'hover');
                    input.style.display = 'none';
                    return;
                }

                // 获取鼠标坐标
                var c = getMouseCoords(e);
                // 判断点击的是不是button按钮
                if ((c.x >= box.left) && (c.x <= box.right) &&
                    (c.y >= box.top) && (c.y <= box.bottom)){

                    input.style.top = c.y - dialogOffset.top + 'px';
                    input.style.left = c.x - dialogOffset.left + 'px';
                    input.style.display = 'block';
                    addClass(self._button, 'hover');

                } else {
                    // 鼠标左键
                    over = false;

                    var check = setInterval(function(){
                        // 如果输入只是点击不要隐藏它
                        // 以防止safari bug

                        if (self.justClicked){
                            return;
                        }

                        if ( !over ){
                            input.style.display = 'none';
                        }

                        clearInterval(check);

                    }, 25);


                    removeClass(self._button, 'hover');
                }
            });

        },

        // 创建具有唯一名称的iframe
        _createIframe : function(){
            // 唯一的名称
            // 我们不能使用getTime，因为它有时会返回
            // safari的相同值:(
            var id = getUID();

            // 删除ie6“此页面包含安全和非安全项目”提示
            // http://tinyurl.com/77w9wh
            var iframe = toElement('<iframe src="javascript:false;" name="' + id + '" />');
            iframe.id = id;
            iframe.style.display = 'none';
            d.body.appendChild(iframe);
            return iframe;
        },

        // 上传文件到服务器
        submit : function(){
            var self = this, settings = this._settings;

            if (this._input.value === ''){
                // there is no file
                return;
            }

            // 从输入获取文件名
            var file = fileFromPath(this._input.value);

            // execute user event
            if (! (settings.onSubmit.call(this, file, getExt(file)) == false)) {
                // Create new iframe for this submission
                var iframe = this._createIframe();

                // Do not submit if user function returns false
                var form = this._createForm(iframe);
                form.appendChild(this._input);

                form.submit();

                d.body.removeChild(form);
                form = null;
                this._input = null;

                // create new input
                this._createInput();

                var toDeleteFlag = false;

                // iframe加载完成获取返回的内容
                addEvent(iframe, 'load', function(e){

                    // 返回为空,跳出
                    if (// For Safari
                    iframe.src == "javascript:'%3Chtml%3E%3C/html%3E';" ||
                    // For FF, IE
                    iframe.src == "javascript:'<html></html>';"){

                        // 第一次，不要删除
                        if( toDeleteFlag ){
                            // Fix busy state in FF3
                            setTimeout( function() {
                                d.body.removeChild(iframe);
                            }, 0);
                        }
                        return;
                    }

                    var doc = iframe.contentDocument ? iframe.contentDocument : frames[iframe.id].document;

                    // fixing Opera 9.26
                    if (doc.readyState && doc.readyState != 'complete'){
                        // Opera fires load event multiple times
                        // Even when the DOM is not ready yet
                        // this fix should not affect other browsers
                        return;
                    }

                    // fixing Opera 9.64
                    if (doc.body && doc.body.innerHTML == "false"){
                        // In Opera 9.64 event was fired second time
                        // when body.innerHTML changed from false
                        // to server response approx. after 1 sec
                        return;
                    }

                    var response;
                    // 判断是不是XML,如果是则返回XML,否则判断返回的是文本还是json
                    if (doc.XMLDocument){
                        // response is a xml document IE property
                        response = doc.XMLDocument;
                    } else if (doc.body){
                        // response is html document or plain text
                        response = doc.body.innerHTML;
                        if (settings.responseType && settings.responseType.toLowerCase() == 'json'){
                            // If the document was sent as 'application/javascript' or
                            // 'text/javascript', then the browser wraps the text in a <pre>
                            // tag and performs html encoding on the contents.  In this case,
                            // we need to pull the original text content from the text node's
                            // nodeValue property to retrieve the unmangled content.
                            // Note that IE6 only understands text/html
                            if (doc.body.firstChild && doc.body.firstChild.nodeName.toUpperCase() == 'PRE'){
                                response = doc.body.firstChild.firstChild.nodeValue;
                            }
                            if (response) {
                                response = window["eval"]("(" + response + ")");
                            } else {
                                response = {};
                            }
                        }
                    } else {
                        // response is a xml document
                        var response = doc;
                    }

                    settings.onComplete.call(self, file, response);

                    // Reload blank page, so that reloading main page
                    // does not re-submit the post. Also, remember to
                    // delete the frame
                    toDeleteFlag = true;

                    // Fix IE mixed content issue
                    iframe.src = "javascript:'<html></html>';";
                });

            } else {
                // clear input to allow user to select same file
                // Doesn't work in IE6
                // this._input.value = '';
                d.body.removeChild(this._input);
                this._input = null;

                // create new input
                this._createInput();
            }
        },

        // 创建表单，将提交到iframe
        _createForm : function(iframe){
            var settings = this._settings;

            // 方法，这里必须指定enctype
            // 因为在IE 6/7中不允许即时更改这个attr
            var form = toElement('<form method="post" enctype="multipart/form-data"></form>');
            form.style.display = 'none';
            form.action = settings.action;
            form.target = iframe.name;
            d.body.appendChild(form);

            // 为每个数据键创建隐藏的输入元素
            for (var prop in settings.data){
                var el = d.createElement("input");
                el.type = 'hidden';
                el.name = prop;
                el.value = settings.data[prop];
                form.appendChild(el);
            }
            return form;
        }
    };
})();