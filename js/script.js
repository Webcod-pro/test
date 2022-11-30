var respons = {
	winState: "",
	smallMedium: false,
	mediumLarge: false,
	sw: 1,
	scrollW: 0,
	large: 1000,
	medium: 640,
	sbWidth: function(){
		$("body").append("<div id='sbarWidth' style='overflow-y: scroll; width: 50px; height: 50px;visibility: hidden'></div>");
		var div = $("#sbarWidth")[0];
		var scrollWidth = div.offsetWidth - div.clientWidth;
		document.body.removeChild(div);
		return scrollWidth;
	},
	sbCheck: function(){
		var b;
		if($(window).height() >= $(document).height()){
			b = false;
		}else{
			b = true;
		}
		return b;
	},
	rCheck : function(){
		if(this.sbCheck()){
			this.sw = $(window).width()+this.scrollW;
		}else{
			this.sw = $(window).width();
		}
	    if(this.sw > this.medium){
	    	if(!this.mediumLarge){
		        /* Вызов функций для больших и средних экранов */
		    	this.mediumLarge = true;
	    	}
	    	if(this.sw > this.large){
		        if(this.winState != "large"){
		        	/* Вызов функций для больших экранов */
		        	this.winState = "large";
			    	this.smallMedium = false;
		        };
	    	};
	    };
	    if(this.sw <= this.large){
	    	if(!this.smallMedium){
		        /* Вызов функций для средних и маленьких экранов */
		    	this.smallMedium = true;
	    	}
	    	if(this.sw > this.medium && this.sw <= this.large){
		        if(this.winState != "medium"){
		        	/* Вызов функций для планшетных экранов */

		        	this.winState = "medium";
		        }
		    }else{
		        if(this.winState != "small"){
		        	/* Вызов функций для мобильных экранов */
		        	this.mediumLarge = false;
		        	this.winState = "small";
		        }
		    };
	    }
	},
	init: function(){
		var $this = this;
		$this.scrollW = $this.sbWidth();
		$this.rCheck();
		$(window).resize(function(){
			$this.rCheck();
		});
	}
};
$(function(){
	$("input, select").styler();
	$(".fancybox").fancybox();
});
