/**
 * @fileOverview 云盘工具公共功能
 * @author wenshuo
 */

/**
 * 根据字节截取字符串
 * @param {Number} len 要截取的双字节数目
 * @param {String/Boolean} appendChars 截取字符串后末尾附带的字符串，默认为"..."；appendChars为false，则末尾不附加任何字符
 * @return {String} 截取的特定长度的字符串
 */
String.prototype.strSub = function (len, appendChars) {
    if (!this || !len) {
        return '';
    }
    if (this.length <= len) {
        return this;
    }
    var strReturn = '';
    len *= 2;
    var a = 0;
    for (var i = 0; i < this.length; i++) {
        if (this.charCodeAt(i) > 255) {
            a += 2;
        } else {
            a++;
        }
        if (a > len) {
            break;
        }
        strReturn += this.charAt(i);
    }

    if (this.length <= strReturn.length || (typeof appendChars != "undefined" && !appendChars)) {
        return strReturn;
    }
    if (typeof appendChars == "undefined") {
        appendChars = '...';
    }
    return strReturn + appendChars;
};
/**
 * 日期格式化
 */
Date.prototype.format = function (format) {
    var o = {
        "M+": this.getMonth() + 1, //month
        "d+": this.getDate(), //day
        "h+": this.getHours(), //hour
        "m+": this.getMinutes(), //minute
        "s+": this.getSeconds(), //second
        "q+": Math.floor((this.getMonth() + 3) / 3), //quarter
        "S": this.getMilliseconds() //millisecond
    };
    if (/(y+)/.test(format)) format = format.replace(RegExp.$1,
            (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o) if (new RegExp("(" + k + ")").test(format))
        format = format.replace(RegExp.$1,
                RegExp.$1.length == 1 ? o[k] :
                        ("00" + o[k]).substr(("" + o[k]).length));
    return format;
};

var clientConfig=require(process.execPath + '/../config.js');

var common = {
    /**
     * 文件大小转换
     * @param {Number} fileSize 文件大小
     * @return {String} 文件大小
     */
    formatFileSize : function (fileSize) {
        if (typeof(fileSize) == "undefined" || fileSize === null || fileSize === '') {
            return '';
        }
        if (fileSize < 1024) {
            return fileSize + 'B';
        }
        if (fileSize < 1024 * 1024) {
            return (fileSize / 1024).toFixed(2) + 'K';
        }
        if (fileSize < 1024 * 1024 * 1024) {
            return (fileSize / 1024 / 1024).toFixed(2) + 'M';
        }
        if (fileSize < 1024 * 1024 * 1024 * 1024) {
            return (fileSize / 1024 / 1024 / 1024).toFixed(2) + 'G';
        }
    },
    /**
     * 获取文件种类
     * @param {String} filename 文件名字
     * @return {String} 文件类型
     */
    getExt: function (filename) {
        var ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
        return ext;
    },
    checkCebxFileType:function (fileType) {
        /*cebx转换服务支持的文件后缀正则表达式*/
        var supportedFileExt = ['^(docx?|xlsx?|txt|pptx?|cebx?|pdf)$', 'ig'];
        var fileExt=fileType.toLowerCase();
        if ((new RegExp(supportedFileExt[0], supportedFileExt[1]).test(fileExt))) {
            return true;
        }
        return false;
    },
    fileMD5 : function (filePath) {
        var fs = require('fs');
        var crypto = require('crypto');
        var str = fs.readFileSync(filePath, 'utf-8');
        var md5Sum = crypto.createHash('md5');
        md5Sum.update(str);
        str = md5Sum.digest('hex');
        return str;
    },
    promptLayer:function (type, msg, ensure, cancel) {
        msg = msg || '发现未知错误';
        $('#mod_layer_tip').find('.prop-tip').find('p').text(msg);
        var options = {
            type: 1, //普通层
            shade: true,
            title: false, //不显示标题
            move: '.layer-hd',
            scrollbar: false,
            closeBtn: false, //不显示关闭按钮
            area: ['360px'],
            shadeClose: false, //点击遮罩关闭
            skin: 'layui-layer-molv', //墨绿风格
            shade: 0.8, //遮罩透明度
            shift: 0,//0-6的动画形式，-1不开启
            success: function (layero, index) {
                /*console.log($(layero).find('.layui-layer-btn0'));
                 $(layero).find('.layui-layer-btn0').attr('tabindex','0');
                 $(layero).find('.layui-layer-btn0').attr('role','button');*/
            },
            content: $('#mod_layer_tip')
        };
        if (type == 0) {
            options.btn = ['确定'];
            options.yes = function (index, layero) {
                if (typeof(ensure) == 'function') {
                    ensure(index, layero);
                }
                else {
                    layer.close(index);
                }
            };
        }
        else if (type == 1) {
            options.btn = ['确定', '取消'];
            options.yes = function (index, layero) {
                if (typeof(ensure) == 'function') {
                    ensure(index, layero);
                }
                else {
                    layer.close(index);
                }
            };
            options.no = function (index, layero) {
                if (typeof(cancel) == 'function') {
                    cancel(index, layero);
                }
                else {
                    layer.close(index);
                }
            };
        }
        layer.open(options);
    }
};

var gui = require('nw.gui');

(function () {
    var win = gui.Window.get();
    var $win = $(window);
    $win.on('dragover', function (e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'none';
    });
    $win.on('drop', function (e) {
        e.preventDefault();
    });

// js自实现窗体拖动
// 避免app-region:drag带来的菜单/双击最大化等
    var $nav = $('.app-bar')
    var dragging = false
    var mouse_x, mouse_y
    var win_x, win_y
    $nav.on('mousedown', function(e){
        e = e.originalEvent || e
        var isbg = $(e.target).closest('.top-titlebar-close-button, #close-button').length < 1
        if (!isbg) return
        dragging = true
        mouse_x = e.screenX
        mouse_y = e.screenY
        win_x = win.x
        win_y = win.y
    })
    $win.on('mousemove', function(e){
        if (!dragging) return
        win.x = win_x + (e.screenX - mouse_x)
        win.y = win_y + (e.screenY - mouse_y)
    })
    $win.on('mouseup', function(){
        dragging = false
    })

    $(document).on('dragstart', 'a', function (e) {
        e.preventDefault();
    });
    $(document).on('dragstart', 'img', function (e) {
        e.preventDefault();
    });

}());