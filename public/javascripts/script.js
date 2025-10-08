toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-bottom-center",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

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


$('#contactForm').validate({
  rules: {
    contactFormName: {required: true},
    contactFormNumber: {required: false},
    contactFormEmail: {required: true, email: true},
    contactFormMessage: {required: true}
  },
  submitHandler: function(form) {
    contactFormEmail();
  }
});

function sendEstimate() {
  alert('This feature is temporarily disabled, sorry for the inconviencence! Feel free to email any questions/concerns to commander@commandercare.net');
  return;
  var emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(!emailRegex.test($('#sendEstEmail').val())) {
    // ERROR TOAST
    return;
  }
  var cat = $('#Category').val()
  var jobType = $('#' + cat + '-JobSelect').find('option:selected').html().trim();
  var step2Measurement = $('#step-2 > div').not('.d-none');
  var measurement = $(step2Measurement).find('input').val();
  var measurementUnit = $(step2Measurement).find('span').html();
  var applianceType;
  if(jobType === 'Appliances') {
    applianceType = $('#step-2 > select').find('option:selected').html().trim();
  }
  var modifiers = getRadios();
  modifiers = modifiers.concat(getInputs());
  modifiers = modifiers.concat(getSelects());
  var additionals = getChecks();
  sendEstimateEmail(cat, jobType, measurement, measurementUnit, applianceType, modifiers, additionals);
}

function getRadios() {
  var modifiers = [];
  var radioButtons = $('#step-3 > div').not('.d-none').find('div > input:radio');
  radioButtons.each(function() {
    if(this.checked) {
      var name = $(this).parent().parent().contents().get(0).nodeValue.trim();
      var value = $(this).parent().find('label').html().trim();
      modifiers.push({name: name, value: value});
    }
  });
  return modifiers;
}

function getInputs() {
  var modifiers = [];
  var nonCheckInputs = $('#step-3 > div').not('.d-none').find('input:not(:checkbox)').not(':radio');
  nonCheckInputs.each(function() {
    var name = $(this).parent().find('label').contents().get(0).nodeValue.trim();
    var value = $(this).val();
    modifiers.push({name: name, value: value});
  });
  return modifiers;
}

function getSelects() {
  var modifiers = [];
  var dropDowns = $('#step-3 > select').not('.d-none');
  dropDowns.each(function() {
    var name;
    var value;
    $(this).children().each(function() {
      if($(this).val() === "-1" && !this.selected) {
        name = $(this).html().trim();
      }
      if($(this).val() !== "-1" && this.selected) {
        value = $(this).html().trim();
      }
    });
    if(name && value) {
      modifiers.push({name: name, value: value});
    }
  });
  return modifiers;
}

function getChecks() {
  var additionals = [];
  var checkBoxes = $('#step-3 > div').not('.d-none').find(':checkbox');
  checkBoxes.each(function() {
    if(this.checked) {
      additionals.push($(this).parent().find('label').html().trim());
    }
  });
  return additionals;
}

function sendEstimateEmail(cat, jobType, measurement, measurementUnit, applianceType, modifiers, additionals) {
  const data = {
    email: $('#sendEstEmail').val(),
    category: cat,
    jobType: jobType,
    measurement: measurement,
    measurementUnit: measurementUnit,
    applianceType: applianceType ? applianceType : null,
    modifiers: JSON.stringify(modifiers),
    additionals: JSON.stringify(additionals),
    price: $('#results > p').html().trim()
  }
  $.ajax({
    type: "POST",
    url: "/sendestimateemail",
    data: data,
    success: function() {
      toastr["success"]("Email Sent!");
    },
    error: function() {
      toastr["success"]("Error sending email. Please try again.");
    }});
}

function contactFormEmail() {
  alert('This feature is temporarily disabled, sorry for the inconviencence! Feel free to email any questions/concerns to commander@commandercare.net');
  return;
  const data = {
    name: $('#contactFormName').val(),
    number: $('#contactFormNumber').val(),
    email: $('#contactFormEmail').val(),
    message: $('#contactFormMessage').val()
  }
  $.ajax({
    type: "POST",
    url: "/sendcontactemail",
    data: data,
    success: function() {
      toastr["success"]("Email Sent!");
    },
    error: function() {
      toastr["success"]("Error sending email. Please try again.");
    }});
}

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
        },
        error: function() {
          alert("Error: Incomplete Form");
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
  let  baseModSum = units.slice(1,7).reduce((tot, e) =>  
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