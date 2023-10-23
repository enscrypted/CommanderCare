
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


$('#mfaSelectButton').click(function() {
  if($("#mfaApp").is(":checked") || $('#mfaEmail').is(":checked")) {
     $('#mfaSelect').hide();
     $('#codeSubmit').show();
     if($('#mfaEmail').is(":checked")) {
      sendEmailToken();
     }
  }
});

$('#mfaEmail').click(function() {
  if(this.checked) {
    $('#mfaApp').prop('checked', false);
    $('#mfaChoice').val('email');
  }
});

$('#mfaApp').click(function() {
  if(this.checked) {
    $('#mfaEmail').prop('checked', false);
    $('#mfaChoice').val('app');
  }
});

$('#rememberMe').click(function() {
  if(this.checked) {
    $('#rememberToken').val(crypto.randomUUID());
    localStorage.setItem('token', $('#rememberToken').val());
  }
  else {
    $('#rememberToken').val(undefined);
    localStorage.removeItem('token');
  }
});

$.validator.addMethod('password', function(value, element) {
  return this.optional(element) || value.length >= 8;
}, 'Password must be at least 8 characters long.');

$.validator.addMethod('username', function(value, element) {
  return this.optional(element) || value.length >= 3;
}, 'Username must be at least 3 characters long.');

$('#loginForm').validate({
  rules: {
    userName: {required: true, username: true},
    userPassword: {required: true, password: true}
  }
});

$('#resetForm').validate({
  rules: {
    userName: {required: true, username: true},
    email: {required: true, email: true}
  }
});

$('#authForm').validate({
  rules: {
    code: {required: true}
  }
});

$('#changePasswordForm').validate({
  rules: {
    password: {required: true},
    newPassword: {required: true, password: true},
    confirmPassword: {required: true, password: true}
  }
});

function sendEmailToken() {
  const data = {
    username: atob($('#authToken').val()).split(';')[0]
  }
  $.ajax({
    type: "POST",
    url: "/portal/authenticate/email",
    data: data,
    success: function() {
      toastr["success"]("Email Sent!");
    },
    error: function() {
      toastr["error"]("Error sending email. Please try again.");
    }
  });
}