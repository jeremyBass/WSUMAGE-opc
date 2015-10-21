(function($,WSU){
	WSU.OPC.Shipping = {
		ship_need_update: true,
		validate_timeout: false,
		
		init: function(){
			WSU.OPC.Shipping.ship_need_update = true;
			WSU.OPC.Decorator.createLoader("#opc-co-shipping-method-form");
			this.initChangeAddress();
			this.initChangeSelectAddress();
			this.initChangeShippingMethod();
		},

		/** CREATE EVENT FOR UPDATE SHIPPING BLOCK **/
		initChangeAddress: function(){
			
			$('#opc-address-form-shipping input').blur(function(){
				if(WSU.OPC.Shipping.ship_need_update){
					WSU.OPC.Shipping.validateForm();
				}
			});

			$('#opc-address-form-shipping').mouseleave(function(){
				if(WSU.OPC.Shipping.ship_need_update)
					WSU.OPC.Shipping.validateForm();
			});
			
			$('#opc-address-form-shipping input').keydown(function(){
				WSU.OPC.Shipping.ship_need_update = true;
				clearTimeout(WSU.OPC.Checkout.ajaxProgress);
				WSU.OPC.Checkout.abortAjax();

				// check if zip
				var el_id = $(this).attr('id');
				if(el_id === 'shipping:postcode'){
					WSU.OPC.Checkout.reloadShippingsPayments('shipping');
				}

				WSU.OPC.Shipping.validateForm(3000);
				
			});
			
			$('#opc-address-form-shipping select').not('#shipping-address-select').change(function(){
				// check if country
				var el_id = $(this).attr('id');
				if(el_id === 'shipping:country_id' || el_id === 'shipping:region_id'){
					WSU.OPC.Checkout.reloadShippingsPayments('shipping', 800);
				}
				
				WSU.OPC.Shipping.ship_need_update = true;
				WSU.OPC.Shipping.validateForm();
			});
		},
		
		/** CREATE VENT FOR CHANGE ADDRESS TO NEW OR FROM ADDRESS BOOK **/
		initChangeSelectAddress: function(){
			$('#shipping-address-select').change(function(){
				if ($(this).val()==''){
					$('#shipping-new-address-form').show();
				}else{
					$('#shipping-new-address-form').hide();
					WSU.OPC.Shipping.validateForm();
				}
			});
			
			
		},
		
		//create observer for change shipping method. 
		initChangeShippingMethod: function(){
			$('.opc-wrapper-opc #shipping-block-methods').on('change', 'input[type="radio"]', function(){
				WSU.OPC.Shipping.saveShippingMethod();
			});
		},
		
		validateForm: function(delay){
			clearTimeout(WSU.OPC.Shipping.validate_timeout);
			if(typeof(delay) === 'undefined' || delay === undefined || !delay){
				delay = 100;
			}
			
			WSU.OPC.Shipping.validate_timeout = setTimeout(function(){
				var mode = WSU.OPC.Billing.need_reload_shippings_payment;
				WSU.OPC.Billing.need_reload_shippings_payment = false;

				var valid = WSU.OPC.Shipping.validateAddressForm();
				if (valid){
					WSU.OPC.Shipping.save();
				}
				else{
					if(mode !== false){
						WSU.OPC.Checkout.checkRunReloadShippingsPayments(mode);
					}
				}
			},delay);
		},
		
		/** VALIDATE ADDRESS BEFORE SEND TO SAVE QUOTE**/
		validateAddressForm: function(form){
			// check all required fields not empty
			var is_empty = false;
			$('#opc-address-form-shipping .required-entry').each(function(){
				if($(this).val() === '' && $(this).css('display') !== 'none' && !$(this).attr('disabled'))
					is_empty = true;
			});
			
			if(is_empty){
				return false;
			}
			
			var addressForm = new Validation('opc-address-form-shipping', { onSubmit : false, stopOnFirst : false, focusOnError : false});
			if (addressForm.validate()){				  		 
				return true;
			}else{				 
				return false;
			}
		},
		
		/** METHOD CREATE AJAX REQUEST FOR UPDATE SHIPPIN METHOD **/
		save: function(){
			var form = $('#opc-address-form-shipping').serializeArray();
				form = WSU.OPC.Checkout.applyShippingMethod(form);
				WSU.OPC.Decorator.showLoader("#opc-co-shipping-method-form","<h1>Saving shipping address</h1>");
				WSU.OPC.ajaxManager.addReq("saveShipping",{
				   type: 'POST',
				   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/saveShipping',
				   dataType: 'json',
				   data: form,
				   success:WSU.OPC.Checkout.prepareAddressResponse
			   });			
		},
		
		saveShippingMethod: function(update_payments, reload_totals){
			if (WSU.OPC.Shipping.validateShippingMethod()===false){
				if (WSU.OPC.saveOrderStatus){
					WSU.OPC.popup_message($('#pssm_msg').html());
				}
				WSU.OPC.saveOrderStatus = false;
				WSU.OPC.Decorator.hideLoader();
				if(typeof(update_payments) !== 'undefined' && update_payments !== undefined && update_payments){
					// if was request to reload payments
					WSU.OPC.Checkout.pullPayments();
				}else{
					if(typeof(reload_totals) === 'undefined' || reload_totals === undefined){
						reload_totals = false;
					}
					if(reload_totals){
						WSU.OPC.Checkout.pullReview();
					}else{
						WSU.OPC.Checkout.unlockPlaceOrder();
					}
				}
				return;
			}

			if (WSU.OPC.Shipping.validateShippingMethod()===false){
				WSU.OPC.popup_message('Please specify shipping method');
				WSU.OPC.Decorator.hideLoader();
				return;
			}
			
			var form = $('#opc-co-shipping-method-form').serializeArray();
			form = WSU.OPC.Checkout.applySubscribed(form); 
			WSU.OPC.Decorator.showLoader(".shipping-method-block","<h1>Saving shipping choice</h1>");
			WSU.OPC.ajaxManager.addReq("saveShippingMethod",{
			   type: 'POST',
			   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/saveShippingMethod',
			   dataType: 'json',
			   data: form,
			   success:WSU.OPC.Checkout.prepareShippingMethodResponse
		   });
		},
		
		validateShippingMethod: function(){			
			var shippingChecked = false;
			$('#opc-co-shipping-method-form input').each(function(){				
				if ($(this).prop('checked')){							
					shippingChecked =  true;
				}
			});
			
			return shippingChecked;
		}		
	};
})(jQuery,jQuery.WSU||{});