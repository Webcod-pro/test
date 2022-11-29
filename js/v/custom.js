var codeList = {
    init: function(){
        var vPlayerApi = VAST.preroll.player;
        var _this = this;

        var $wrap = $("<div class='partners-wrapper'><ol></ol></div>");
        this.list = $list = $wrap.find("ol");
        $("body").append($wrap);

        vPlayerApi.addCustomEvent('update', function () {
            _this.update();
        });   
        vPlayerApi.addCustomEvent('ended', function () {
            _this.update();
        });  

    },
    update: function(){
        var vPlayerItems = $('.vast-wrap .v-player__item');
        var _this = this;
        this.list.empty();
        vPlayerItems.each(function(){
            var $slots = $(this).find('.v-player__slot');
            var $li = $("<li/>", {
                text: $(this)[0].data.systemName + " - ",
            });
            var $innerList = $("<ol />");
            $slots.each(function(i){
                var $innerLi = $("<li/>", {
                    text: "ad-"+i,
                });
                $innerList.append($innerLi);
            });
            $li.append($innerList);
            if($(this).hasClass("ready")) $li.addClass("ready");
            _this.list.append($li);
        });
    }
};
$(function(){      
    codeList.init();     
});



var codeListMidroll = {
    init: function(){
        var vPlayerApi = VAST.midroll.player;
        var _this = this;

        var $wrap = $("<div class='partners-wrapper midroll'><ol></ol></div>");
        this.list = $list = $wrap.find("ol");
        $("body").append($wrap);

        vPlayerApi.addCustomEvent('update', function () {
            _this.update();
        });   
        vPlayerApi.addCustomEvent('ended', function () {
            _this.update();
        });  

    },
    update: function(){
        var vPlayerItems = $('.midroll-wrap .v-player__item');
        var _this = this;
        this.list.empty();
        vPlayerItems.each(function(){
            var $slots = $(this).find('.v-player__slot');
            var $li = $("<li/>", {
                text: $(this)[0].data.systemName + " - ",
            });
            var $innerList = $("<ol />");
            $slots.each(function(i){
                var $innerLi = $("<li/>", {
                    text: "ad-"+i,
                });
                $innerList.append($innerLi);
            });
            $li.append($innerList);
            if($(this).hasClass("ready")) $li.addClass("ready");
            _this.list.append($li);
        });
    }
};
$(function(){      
    codeListMidroll.init();     
});
