$('#Category').on('change', function() {
	var id = $(this).val() + '-JobSelect';
	$('#step-2').addClass('d-none');
	$('#step-3').addClass('d-none');
	$('#estSubmit').addClass('d-none');
	$('.type').addClass('d-none');
	$('#resultCont').addClass('d-none');
	$('.jobType').each(function() {
		(this.id === id)
		? $(this).removeClass("d-none")
		: $(this).addClass("d-none");
	});
	
});

$('.jobType').on('change', function() {
	var classCombo = '.' + $(this).val() + '.bu';
	var appliance = '.' + $(this).val() + '.type';
	$('#step-3').addClass('d-none');	
	$('#estSubmit').addClass('d-none');  
	$('.bu').addClass('d-none');
	$('.type').addClass('d-none');
	$('#resultCont').addClass('d-none');
	$("#step-2").removeClass("d-none");
	$(classCombo).removeClass("d-none");
	if($(this).val() === 'Appliances') {
		$(appliance).removeClass('d-none');
		$('#applianceBR').removeClass('d-none');
	}
});

$('.s2').on('input', function() {
	var classType = '#' + $('#Category').val() + '-JobSelect';
	var job = '.field.' + $(classType).val();
	if(job === '.field.Appliances') {
	  $('#ApplianceExcept').addClass('d-none');
	}
	else {
		$('#ApplianceExcept').removeClass('d-none');
	}
	$('.field').addClass('d-none');
	$("#step-3").removeClass("d-none");
	$(job).removeClass("d-none");
	$('#estSubmit').removeClass('d-none');
});

$("input[type='radio']").on('change', function(){
	$("input[type='radio']").each(function(){
		if($(this).is(':checked')) {
			$(this).val('1');
		}
		else {
			$(this).val('0');
		}
});});

$("input[type='checkbox']").on('change', function(){
	$("input[type='checkbox']").each(function(){
		if($(this).is(':checked')) {
			$(this).val('1');
		}
		else {
			$(this).val('0');
		}
});});

$('#numItems').on('input', function(){
	$('#cFanMulti').val(parseInt(($(this).val()) - 1).toString());
	
});

$('#BathroomSU').on('change', function(){
	if(parseInt($(this).val()) > -1) {
		$('#BRSU').val('1');
	}
	else {
		$('#BRSU').val('0');
	}
	
});

$('#BathroomTU').on('change', function(){
	if(parseInt($(this).val()) > -1) {
		$('#BRTU').val('1');
	}
	else {
		$('#BRTU').val('0');
	}
	
});

$('#ElectricTU').on('change', function(){
	if(parseInt($(this).val()) > -1) {
		$('#EITU').val('1');
	}
	else {
		$('#EITU').val('0');
	}
});

$('#surfC').on('input', function(){
	if(parseInt($(this).val()) > 5) {
		$('#TSSU').val((parseInt($(this).val()) - 5).toString());
	}
	else {
		$('#TSSU').val('0');
	}
});

function generateEst() {
	var classType = '#' + $('#Category').val() + '-JobSelect';
	var job = "." + $(classType).val();
	var type = job + '.type';
    $.ajax({
        type: "POST",
        url: "/",
        data: {
            "type": $(type).val(),
        },
        success: function(data) {
            if(!data) {
                alert("bad type")
            } else {
                displayEst(calculateEst(data.elements, job));
            }
        }
    });
}

function calculateEst(p, job) {
	let units = ['.bu', '.bm1u', '.bm2u', '.bm3u', '.bm4u', '.bm5u', 
							 '.bm6u', '.su', '.smu', '.tu', '.tmu', '.fu', '.cu'];

  units = units.map(e => ($(job + e).val() === "")
													? parseFloat($(job + e).children('input').val())
													: parseFloat($(job + e).val()));

	let dataIndex = 1;
  let	baseModSum = units.slice(1,7).reduce((tot, e) =>  
																				tot += e * p[dataIndex++], 0);
  
  let sumParts = [(p[0] + baseModSum) * units[0], 
									(p[7] + units[8] * p[8]) * units[7],
								  (p[9] + units[10] * p[10]) * units[9],
								  units[11] * p[11], 
									units[12] * p[12]];

	return (sumParts[0] + sumParts[1] + sumParts[2] + sumParts[3]) * (1 + sumParts[4]); 
  
}

function displayEst(cost) {
	$('#results > p').html('$' + cost.toFixed(2));
	$('#resultCont').removeClass('d-none');
}

$('#carouselSelect').on('change', function() {
	let selected = '#' + $(this).val() + "Pics";
	$('.jobImg').addClass('d-none');
	$(selected).removeClass('d-none');
});


function notDevd() {
	alert('This feature isn\'t quite ready yet, but check back soon!\n\
	In the meantime, please contact us directly for any of your needs!')
}