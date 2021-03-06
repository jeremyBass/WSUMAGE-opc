(function($,WSU){
	WSU.OPC.Billing = {
		bill_need_update: true,
		need_reload_shippings_payments: false,
		validate_timeout: false,
		
		init: function(){
			WSU.OPC.Billing.bill_need_update = true;
			WSU.OPC.Decorator.createLoader("#opc-address-form-billing");
			//set flag use billing for shipping and init change flag
			var use_for_ship = false;
			var el = $('input[name="billing[use_for_shipping]"]');
			if(typeof(el) !== 'undefined' && el !== undefined && el){
				if(el.prop('type') === 'checkbox'){
					if(el.is(':checked')){
						use_for_ship = true;
					}
				}else{
					use_for_ship = true;
				}
			}else{
				use_for_ship = true;
			}

			if(use_for_ship){
				this.setBillingForShipping(true);
			}else{
				this.setBillingForShipping(false, true);
			}
			
			$('input[name="billing[use_for_shipping]"]').change(function(){
				if ($(this).is(':checked')){
					WSU.OPC.Billing.setBillingForShipping(true);
					$('#opc-address-form-billing select[name="billing[country_id]"]').change();
					WSU.OPC.Billing.need_reload_shippings_payments = 'billing';
					WSU.OPC.Billing.validateForm();
				}else{
					WSU.OPC.Billing.setBillingForShipping(false);
					WSU.OPC.Billing.need_reload_shippings_payments = 'shipping';
					WSU.OPC.Shipping.validateForm();
				}
			});
			
			
			//update password field
			$('input[name="billing[create_account]"]').on('click',function(e){
				e.preventDefault();
				if ($(this).is(':checked')){
					$('#register-customer-password').removeClass('hidden');
					$('input[name="billing[customer_password]"]').addClass('required-entry');
					$('input[name="billing[confirm_password]"]').addClass('required-entry');
				}else{
					$('#register-customer-password').addClass('hidden');
					$('input[name="billing[customer_password]"]').removeClass('required-entry');
					$('input[name="billing[confirm_password]"]').removeClass('required-entry');
					$('#register-customer-password input').val('');
				}
			});
			
			this.initChangeAddress();
			this.initChangeSelectAddress();
		},
		
		/** CREATE EVENT FOR UPDATE SHIPPING BLOCK **/
		initChangeAddress: function(){

			$('#opc-address-form-billing input').blur(function(){
				if(WSU.OPC.Billing.bill_need_update){
					WSU.OPC.Billing.validateForm();
				}
			});

			$('#opc-address-form-billing').mouseleave(function(){
				if(WSU.OPC.Billing.bill_need_update){
					WSU.OPC.Billing.validateForm();
				}
			});
			
			$('#opc-address-form-billing input').keydown(function(){
				WSU.OPC.Billing.bill_need_update = true;
				clearTimeout(WSU.OPC.Checkout.ajaxProgress);
				WSU.OPC.Checkout.abortAjax();
				
				// check if zip
				var el_id = $(this).attr('id');
				if(el_id === 'billing:postcode'){
					WSU.OPC.Checkout.reloadShippingsPayments('billing');
				}

				WSU.OPC.Billing.validateForm(3000);
			});
			
			$('#opc-address-form-billing select').not('#billing-address-select').change(function(){
				// check if country
				var el_id = $(this).attr('id');
				if(el_id === 'billing:country_id' || el_id === 'billing:region_id'){
					WSU.OPC.Checkout.reloadShippingsPayments('billing', 800);
				}
				
				WSU.OPC.Billing.bill_need_update = true;
				WSU.OPC.Billing.validateForm();
			});			
		},
		
		validateForm: function(delay){
			clearTimeout(WSU.OPC.Billing.validate_timeout);
			if(typeof(delay) === 'undefined' || delay === undefined || !delay){
				delay = 100;
			}
			
			WSU.OPC.Billing.validate_timeout = setTimeout(function(){
				var mode = WSU.OPC.Billing.need_reload_shippings_payment;
				WSU.OPC.Billing.need_reload_shippings_payment = false;

				var valid = WSU.OPC.Billing.validateAddressForm();
				if (valid){
					WSU.OPC.Billing.save();
				}else{
					if(mode !== false){
						WSU.OPC.Checkout.checkRunReloadShippingsPayments(mode);
					}
				}
			},delay);
		},
		
		
		/** CREATE EVENT FOR CHANGE ADDRESS TO NEW OR FROM ADDRESS BOOK **/
		initChangeSelectAddress: function(){
			$('#billing-address-select').change(function(){
				if ($(this).val()==''){
					$('#billing-new-address-form').show();
				}else{
					$('#billing-new-address-form').hide();
					WSU.OPC.Billing.validateForm();
				}
			});
			
			
		},
		
		/** VALIDATE ADDRESS BEFORE SEND TO SAVE QUOTE**/
		validateAddressForm: function(form){
			// check all required fields not empty
			var is_empty = false;
			$('#opc-address-form-billing .required-entry').each(function(){
				if($(this).val() === '' && $(this).css('display') !== 'none' && !$(this).attr('disabled')){
					is_empty = true;
				}
			});
			if(is_empty){
				return false;
			}

			var addressForm = new Validation('opc-address-form-billing', { onSubmit : false, stopOnFirst : false, focusOnError : false});
			if (addressForm.validate()){				  		 
				return true;
			}else{				 
				return false;
			}
		},
		
		/** SET SHIPPING AS BILLING TO TRUE OR FALSE **/
		setBillingForShipping:function(useBilling, skip_copy){
			if (useBilling==true){
				$('input[name="billing[use_for_shipping]"]').prop('checked', true);
				$('input[name="shipping[same_as_billing]"]').prop('checked', true);
				$('#opc-address-form-shipping').addClass('hidden');				
			}else{
				if(typeof(skip_copy) === 'undefined' || skip_copy === undefined){
					skip_copy = false;
				}
				if(!skip_copy){
					this.pushBilingToShipping();
				}
				$('input[name="billing[use_for_shipping]"]').prop('checked', false);
				$('input[name="shipping[same_as_billing]"]').prop('checked', false);
				$('#opc-address-form-shipping').removeClass('hidden');
			}
			
		}, 
		
		/** COPY FIELD FROM BILLING FORM TO SHIPPING **/
		pushBilingToShipping:function(clearShippingForm){
			//pull country
			var valueCountry = $('#billing-new-address-form select[name="billing[country_id]"]').val();
			$('#opc-address-form-shipping  select[name="shipping[country_id]"] [value="' + valueCountry + '"]').prop("selected", true);	
			shippingRegionUpdater.update();
			
			
			//pull region id
			var valueRegionId = $('#billing-new-address-form select[name="billing[region_id]"]').val();
			$('#opc-address-form-shipping  select[name="shipping[region_id]"] [value="' + valueRegionId + '"]').prop("selected", true);
			
			//pull other fields	
			$('#billing-new-address-form input').not(':hidden, :input[type="checkbox"]').each(function(){
				var name = $(this).attr('name');
				var value = $(this).val();
				var shippingName =  name.replace( /billing/ , 'shipping');
				
				$('#opc-address-form-shipping input[name="'+shippingName+'"]').val(value);

			});
			
			//pull address field
			$('#billing-new-address-form input[name="billing[street][]"]').each(function(indexBilling){
				var valueAddress = $(this).val();
				$('#opc-address-form-shipping input[name="shipping[street][]"]').each(function(indexShipping){
					if (indexBilling==indexShipping){
						$(this).val(valueAddress);
					}
				});				
			});
			
			//init trigger change shipping form
			$('#opc-address-form-shipping select[name="shipping[country_id]"]').change();
		},

		/** METHOD CREATE AJAX REQUEST FOR UPDATE BILLING ADDRESS
		save: function(){
			if (WSU.OPC.Checkout.ajaxProgress!==false){
				clearTimeout(WSU.OPC.Checkout.ajaxProgress);
			}

			// stop reload shippings/payments logic
			if (WSU.OPC.Checkout.updateShippingPaymentProgress!==false){
				clearTimeout(WSU.OPC.Checkout.updateShippingPaymentProgress);
			}
			
			if (WSU.OPC.Checkout.xhr2!=null){
				WSU.OPC.Checkout.xhr2.abort();
			}
			////
			
			WSU.OPC.Checkout.ajaxProgress = setTimeout(function(){
					var form = $('#opc-address-form-billing').serializeArray();
					form = WSU.OPC.Checkout.applyShippingMethod(form);					
					form = WSU.OPC.Checkout.applySubscribed(form); 
					
					if (WSU.OPC.Checkout.xhr!=null){
						WSU.OPC.Checkout.xhr.abort();
					}
					
					if($('input[name="billing[use_for_shipping]"]').is(':checked'))
						WSU.OPC.Decorator.showLoader();
					else
						WSU.OPC.Checkout.lockPlaceOrder(1);
					
					WSU.OPC.Billing.bill_need_update = false;		
					WSU.OPC.Checkout.xhr = $.post(WSU.OPC.Checkout.config.baseUrl + 'onepage/json/saveBilling',form, WSU.OPC.Checkout.prepareAddressResponse,'json');
			}, 500);
		}, **/
		
		
		save: function(){
			
			var form = $('#opc-address-form-billing').serializeArray();
			form = WSU.OPC.Checkout.applyShippingMethod(form);		 			
			form = WSU.OPC.Checkout.applySubscribed(form); 
			form.push({ "name":"billing[use_for_shipping]", "value": jQuery('[name*=use_for_shipping]:checked').length });
			if($('input[name="billing[use_for_shipping]"]').is(':checked')){
				WSU.OPC.Decorator.showLoader();
			}else{
				WSU.OPC.Checkout.lockPlaceOrder(1);
			}
			
			WSU.OPC.Billing.bill_need_update = false;		
			WSU.OPC.Decorator.showLoader("#opc-address-form-billing","<h1>Saving billing information</h1>");
			WSU.OPC.ajaxManager.addReq("saveBilling",{
			   type: 'POST',
			   url: WSU.OPC.Checkout.config.baseUrl + 'onepage/json/saveBilling',
			   dataType: 'json',
			   data: form,
			   success: WSU.OPC.Checkout.prepareAddressResponse
		   });
		}
	};
})(jQuery,jQuery.WSU||{});