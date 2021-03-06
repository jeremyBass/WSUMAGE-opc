jQuery.WSU=jQuery.WSU||{};
(function($,WSU){
	Billing =  Class.create();
	Shipping =  Class.create();
	WSU.OPC = {
		agreements : null,
		saveOrderStatus:false,
		is_subscribe:false,
			
//too old??
		savingOrder:false,
		ready_billing:false,
		ready_shipping:false,
		ready_shipping_method:false,
		ready_payment_method:false,
		ready_discounts:false,
		ready_reviewed:false,
				
		initMessages: function(){
			$('.close-message-wrapper, .opc-messages-action .button').on('click',function(e){
				e.preventDefault();
				$('.opc-message-wrapper').hide();
				$('.opc-message-container').empty();
			});
		},
		
		popup_message: function(html_message,sizeObj){
			sizeObj = sizeObj || {width: 350,minHeight: 25,}
			if($("#mess").length<=0)$('body').append('<div id="mess">');
			$("#mess").html((typeof html_message === 'string' || html_message instanceof String)?html_message:html_message.html());
			
			$("#mess").prepend('<button style="float:right" id="ok" >Ok</button>');
			
			var defaultParams = {
				autoOpen: true,
				resizable: false,
				modal: true,
				draggable : false,
				create:function(){
					$('.ui-dialog-titlebar').remove();
					$(".ui-dialog-buttonpane").remove();
					$('body').css({overflow:"hidden"});
				},
				buttons:{
					Ok:function(){
						$( this ).dialog( "close" );
					}
				},
				open:function(){
					$( "#ok" ).on('click',function(e){
						e.preventDefault();
						$( "#mess" ).dialog( "close" );
					});
				},
				close: function() {
					$('body').css({overflow:"auto"});
					$( "#mess" ).dialog( "destroy" );
					$( "#mess" ).remove();
				}																										
			}
			defaultParams = jQuery.extend(defaultParams,sizeObj);
			$( "#mess" ).dialog(defaultParams);
		},
		ajaxManager: (function() {
			var requests = [];
			var requests_obj = {};
			 return {
				addReq:  function(action,opt) {
					if( $.inArray(action, requests) > -1 ){
						//not this assums that the first one is what we wnt to use
					}else{
						requests.push(action);
						requests_obj[action]=opt;
						console.log(requests);
						console.log(requests_obj);
					}
				},
				removeReq:  function(action,opt) {
					if( $.inArray(opt, requests) > -1 ){
						requests.splice($.inArray(action, requests), 1);
						delete requests_obj[action]; 
					}
				},
				run: function() {
					var self = this, oriSuc;
		
					if( requests.length ) {
						var action = requests[0];
						var post_obj = requests_obj[action];
						oriSuc = post_obj.complete;
		
						post_obj.complete = function() {
							 if( typeof(oriSuc) === 'function' ){
								 oriSuc();
							 }
							 requests.shift();
							 self.run.apply(self, []);
							 console.log(requests);
						};   
						$.ajaxSetup({ cache: false });
						$.ajax(post_obj);
					} else {
					  self.tid = setTimeout(function() {
						 self.run.apply(self, []);
					  }, 200);
					}
				},
				stop:  function() {
					requests = [];
					requests_obj = {};
					clearTimeout(this.tid);
				}
			 };
		}()),
		
		
		/** CREATE EVENT FOR SAVE ORDER **/
		initSaveOrder: function(){
			$(document).on('click', '.opc-btn-checkout', function(e){
				e.preventDefault();
				if (WSU.OPC.Checkout.disabledSave==true){
					return;
				}

				// check agreements
				var mis_aggree = false;
				$('#checkout-agreements input[name*="agreement"]').each(function(){
					if(!$(this).is(':checked')){
						mis_aggree = true;
					}
				});
				
				if(mis_aggree){
					$('.opc-message-container').html($('#agree_error').html());
					$('.opc-message-wrapper').show();
					WSU.OPC.Decorator.hideLoader();
					WSU.OPC.Checkout.unlockPlaceOrder();
					WSU.OPC.saveOrderStatus = false;
					return false;
				}
				///
				
				var addressForm = new VarienForm('opc-address-form-billing');
				if (!addressForm.validator.validate()){
					return;
				}
				
				if (!$('input[name="billing[use_for_shipping]"]').prop('checked')){
					var addressForm = new VarienForm('opc-address-form-shipping');
					if (!addressForm.validator.validate()){				
						return;
					}
				}
				
				// check if LIPP enabled
				if(typeof(WSU.LIPP) !== 'undefined' && WSU.LIPP !== undefined && WSU.LIPP !== '' && WSU.LIPP) {
					if(WSU.LIPP.lipp_enabled){
						var method = payment.currentMethod;
						if (method.indexOf('paypaluk_express')!==-1 || method.indexOf('paypal_express')!==-1){
							if (WSU.OPC.Checkout.config.comment!=="0"){
								WSU.OPC.saveCustomerComment();
							}
							WSU.LIPP.redirectPayment();
							return;
						}
					}			    	
				}

				WSU.OPC.saveOrderStatus = true;
				WSU.OPC.Plugin.dispatch('saveOrderBefore');
				if (WSU.OPC.Checkout.isVirtual===false){
					WSU.OPC.Checkout.lockPlaceOrder();
					WSU.OPC.Shipping.saveShippingMethod();
				}else{
					WSU.OPC.validatePayment();
				}
			});
			
		},
		
		
		
		/** INIT CHAGE PAYMENT METHOD **/
		initPayment: function(){
			WSU.OPC.removeNotAllowedPaymentMethods();
			WSU.OPC.bindChangePaymentFields();
			
			$(document).on('click', '#co-payment-form input[type="radio"]', function(event){
				WSU.OPC.removeNotAllowedPaymentMethods();
				WSU.OPC.validatePayment();
			});
		},
		
		/** remove not allowed payment method **/
		removeNotAllowedPaymentMethods: function(){
			// remove p_method_authorizenet_directpost
			var auth_dp_obj = $('#p_method_authorizenet_directpost');
			if( auth_dp_obj.length ) {
				if(auth_dp_obj.attr('checked')){
					auth_dp_obj.attr('checked', false);
				}
				auth_dp_obj.parent('dt').remove();
				$('#payment_form_authorizenet_directpost').parent('dd').remove();
				$('#directpost-iframe').remove();
				$('#co-directpost-form').remove();
			}
		},
		
		/** CHECK PAYMENT IF PAYMENT IF CHECKED AND ALL REQUIRED FIELD ARE FILLED PUSH TO SAVE **/
		validatePayment: function(){	
			
			// check all required fields not empty
			var is_empty = false;
			$('#co-payment-form .required-entry').each(function(){
				if($(this).val() === '' && $(this).css('display') !== 'none' && !$(this).attr('disabled')){
					is_empty = true;
				}
			});

			if(!WSU.OPC.saveOrderStatus){
				if(is_empty){
					WSU.OPC.saveOrderStatus = false;
					WSU.OPC.Decorator.hideLoader();
					WSU.OPC.Checkout.unlockPlaceOrder();				
					return false;
				}
			}

			var vp = payment.validate();
			if(!vp){
				WSU.OPC.saveOrderStatus = false;
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();
				return false;
			}

			var paymentMethodForm = new Validation('co-payment-form', { onSubmit : false, stopOnFirst : false, focusOnError : false});
				
			if (paymentMethodForm.validate()){
				WSU.OPC.savePayment();
			}else{
				WSU.OPC.saveOrderStatus = false;
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();
				
				WSU.OPC.bindChangePaymentFields();
			}
			
			
		},
		

		/** BIND CHANGE PAYMENT FIELDS **/ 
		bindChangePaymentFields: function(){
			WSU.OPC.unbindChangePaymentFields();
			
			$('#co-payment-form input').on('keyup',function(e){
				e.preventDefault();
				clearTimeout(WSU.OPC.Checkout.formChanging);
				WSU.OPC.Checkout.formChanging = setTimeout(function(){
					if (WSU.OPC.Checkout.ajaxProgress!=false){
						clearTimeout(WSU.OPC.Checkout.ajaxProgress);
					}
					WSU.OPC.Checkout.ajaxProgress = setTimeout(function(){
						WSU.OPC.validatePayment();
					}, 1000);
				}, 500);
			});
			$('#co-payment-form select').on('change',function(e){
				e.preventDefault();
				clearTimeout(WSU.OPC.Checkout.formChanging);
				WSU.OPC.Checkout.formChanging = setTimeout(function(){
					if (WSU.OPC.Checkout.ajaxProgress!=false){
						clearTimeout(WSU.OPC.Checkout.ajaxProgress);
					}
					WSU.OPC.Checkout.ajaxProgress = setTimeout(function(){
						WSU.OPC.validatePayment();
					}, 1000);
				}, 500);
			});
		},


	
		/** UNBIND CHANGE PAYMENT FIELDS **/
		unbindChangePaymentFields: function(){
			$('#co-payment-form input').off('keyup');
			$('#co-payment-form select').off('change');
		},		
		
		/** SAVE PAYMENT **/		
		savePayment: function(){
			
			if (WSU.OPC.Checkout.xhr!=null){
				WSU.OPC.Checkout.xhr.abort();
			}
			
			WSU.OPC.Checkout.lockPlaceOrder();
			if (payment.currentMethod !== 'stripe') {
				var form = $('#co-payment-form').serializeArray();
				WSU.OPC.Decorator.showLoader('#co-payment-form',"<h1>Saving payment choice</h1>");
				WSU.OPC.ajaxManager.addReq("savePayment",{
				   type: 'POST',
				   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/savePayment',
				   dataType: 'json',
				   data: form,
				   success: WSU.OPC.preparePaymentResponse
			   });
			}else{
				Stripe.createToken({
					
					name: $('stripe_cc_owner').value,
					number: $('stripe_cc_number').value,
					cvc: $('stripe_cc_cvc').value,
					exp_month: $('stripe_cc_expiration_month').value,
					exp_year: $('stripe_cc_expiration_year').value
				}, function(status, response) {
					if (response.error) {
						WSU.OPC.Decorator.hideLoader();
						WSU.OPC.Checkout.xhr = null;
						WSU.OPC.Checkout.unlockPlaceOrder();
						alert(response.error.message);
					} else {
						$('stripe_token').value = response['id'];
						var form = $('#co-payment-form').serializeArray();
						WSU.OPC.Decorator.showLoader('.payment-block',"<h1>Saving payment choice</h1>");
						
						WSU.OPC.ajaxManager.addReq("savePayment",{
						   type: 'POST',
						   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/savePayment',
						   dataType: 'json',
						   data: form,
						   success: WSU.OPC.preparePaymentResponse
					   });
					}
				});
			}	
		},
		
		/** CHECK RESPONSE FROM AJAX AFTER SAVE PAYMENT METHOD **/
		preparePaymentResponse: function(response){
			WSU.OPC.Decorator.hideLoader('.payment-block');	
			WSU.OPC.Checkout.xhr = null;
			
			WSU.OPC.agreements = $('#checkout-agreements').serializeArray();
			if (typeof(response.review)!= "undefined" && WSU.OPC.saveOrderStatus===false){					
				$('#review-block').html(response.review);
				if($( "tr:contains('Free Shipping - Free')" ).length){
					$( "tr:contains('Free Shipping - Free')" ).hide();
				}
				WSU.OPC.Checkout.removePrice();
			}		
			WSU.OPC.getSubscribe();

			if (typeof(response.review)!=="undefined"){
				WSU.OPC.Decorator.updateGrandTotal(response);
				$('#opc-review-block').html(response.review);
				WSU.OPC.Checkout.removePrice();
				
				// need to recheck subscribe and agreenet checkboxes
				WSU.OPC.recheckItems();
			}

			if (typeof(response.error) !== "undefined"){
				WSU.OPC.Plugin.dispatch('error');
				WSU.OPC.popup_message(response.error);
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();
				WSU.OPC.saveOrderStatus = false;
				WSU.OPC.ready_payment_method=false;
				return;
			}

			//SOME PAYMENT METHOD REDIRECT CUSTOMER TO PAYMENT GATEWAY
			WSU.OPC.ready_payment_method=true;
			if (typeof(response.redirect) !== "undefined" && WSU.OPC.saveOrderStatus===true){
				WSU.OPC.Checkout.xhr = null;
				WSU.OPC.Plugin.dispatch('redirectPayment', response.redirect);
				if (WSU.OPC.Checkout.xhr==null){
					setLocation(response.redirect);
				} else {
					WSU.OPC.Decorator.hideLoader();
					WSU.OPC.Checkout.unlockPlaceOrder();					
				}
				return;
			}
			
			if (WSU.OPC.saveOrderStatus===true){
				WSU.OPC.saveOrder();				
			} else {
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();				
			}
			
			WSU.OPC.Plugin.dispatch('savePaymentAfter');
		}, 
		
		/** SAVE ORDER **/
		saveOrder: function(){
			var form = $('#co-payment-form').serializeArray();
			form  = WSU.OPC.checkAgreement(form);
			form  = WSU.OPC.checkSubscribe(form);
			form  = WSU.OPC.getComment(form);
			
			WSU.OPC.Decorator.showLoader("#general_message","<h1>Processing order.</h1>");
			WSU.OPC.Checkout.lockPlaceOrder();				

			if (WSU.OPC.Checkout.config.comment!=="0"){
				WSU.OPC.saveCustomerComment();
				setTimeout(function(){
					WSU.OPC.callSaveOrder(form);				
				},600);
			}else{
				WSU.OPC.callSaveOrder(form);
			}
		},
	
		callSaveOrder: function(form){
			WSU.OPC.Plugin.dispatch('saveOrder');
			WSU.OPC.savingOrder=true;
			WSU.OPC.ajaxManager.addReq("saveOrder",{
			   type: 'POST',
			   url: WSU.OPC.Checkout.saveOrderUrl,
			   dataType: 'json',
			   data: form,
			   success: WSU.OPC.prepareOrderResponse
		   });		
		},
		
		/** SAVE CUSTOMER COMMNET **/
		saveCustomerComment: function(){
			WSU.OPC.ajaxManager.addReq("saveComment",{
			   type: 'POST',
			   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/comment',
			   dataType: 'json',
			   data: {"comment": $('#customer_comment').val()},
			   success: function(){}
		   });
		}, 
		
		getComment: function(form){
			var com = $('#customer_comment').val();
			form.push({"name":"customer_comment", "value":com});
			return form;
		},
		
		/** ADD AGGREMENTS TO ORDER FORM **/
		checkAgreement: function(form){
			$.each(WSU.OPC.agreements, function(index, data){
				form.push(data);
			});
			return form;
		},
		
		/** ADD SUBSCRIBE TO ORDER FORM **/
		getSubscribe: function(){
			if ($('#is_subscribed').length){
				if ($('#is_subscribed').is(':checked')){
					WSU.OPC.is_subscribe = true;
				}else{
					WSU.OPC.is_subscribe = false;
				}
			}else{
				WSU.OPC.is_subscribe = false;
			}
		},
		
		checkSubscribe: function(form){
			if(WSU.OPC.is_subscribe){
				form.push({"name":"is_subscribed", "value":"1"});
			}else{
				form.push({"name":"is_subscribed", "value":"0"});
			}
			return form;
		},
		
		/** Check checkboxes after refreshing review section **/
		recheckItems: function(){
			// check subscribe
			if ($('#is_subscribed').length){
				if(WSU.OPC.is_subscribe)
					$('#is_subscribed').prop('checked', true);
				else
					$('#is_subscribed').prop('checked', false);
			}
			
			// check agree
			WSU.OPC.recheckAgree();
		},
		
		recheckAgree: function(){			
			if(WSU.OPC.agreements !== null){
				$.each(WSU.OPC.agreements, function(index, data){
					$('#checkout-agreements input').each(function(){
						if(data.name === $(this).prop('name'))
							$(this).prop('checked', true);
					});
				});
			}
		},
		
		/** CHECK RESPONSE FROM AJAX AFTER SAVE ORDER **/
		prepareOrderResponse: function(response){
			WSU.OPC.Checkout.xhr = null;
			if (typeof(response.error) !== "undefined" && response.error!==false){
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();

				WSU.OPC.saveOrderStatus = false;
				$('.opc-message-container').html(response.error);
				$('.opc-message-wrapper').show();
				WSU.OPC.Plugin.dispatch('error');
				return;
			}
			
			if (typeof(response.error_messages) !== "undefined" && response.error_messages!==false){
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();				
				
				WSU.OPC.saveOrderStatus = false;
				$('.opc-message-container').html(response.error_messages);
				$('.opc-message-wrapper').show();
				WSU.OPC.Plugin.dispatch('error');
				return;
			}
			
			if (typeof(response.redirect) !== "undefined"){
				if (response.redirect!==false){
					setLocation(response.redirect);
					return;
				}
			}
			
			if (typeof(response.update_section) !== "undefined"){
				WSU.OPC.Decorator.hideLoader();
				WSU.OPC.Checkout.unlockPlaceOrder();				
				
				//create catch for default logic  - for not spam errors to console
				try{
					$('#checkout-' + response.update_section.name + '-load').html(response.update_section.html);
				}catch(e){
					
				}
				
				WSU.OPC.prepareExtendPaymentForm();
				$('#payflow-advanced-iframe').show();
				$('#payflow-link-iframe').show();
				$('#hss-iframe').show();
				
			}
			WSU.OPC.Decorator.hideLoader();
			WSU.OPC.Checkout.unlockPlaceOrder();				
			
			WSU.OPC.Plugin.dispatch('responseSaveOrder', response);
		},
	};
})(jQuery,jQuery.WSU);