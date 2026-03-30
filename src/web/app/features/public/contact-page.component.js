(function () {
  'use strict';

  angular.module('morningBriefingApp').component('contactPage', {
    template:
      '<section class="public-page public-page--contact">' +
      '  <div class="public-contact-layout">' +
      '    <article class="legal-page public-contact-copy">' +
      '      <span class="public-page__eyebrow">Contact</span>' +
      '      <h1>Contact Us</h1>' +
      '      <p class="public-page__lead">Questions, feedback, partnership ideas, or implementation help are all welcome. Send a note and it will be delivered to the Daily Briefing inbox.</p>' +
      '      <p class="public-contact-copy__detail">Messages from this form are sent to <strong>ralfepoisson@gmail.com</strong>.</p>' +
      '    </article>' +
      '    <article class="legal-page public-contact-form-card">' +
      '      <form ng-submit="$ctrl.submit()" novalidate>' +
      '        <label class="form-label" for="contactName">Name</label>' +
      '        <input id="contactName" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.name" required />' +
      '        <label class="form-label mt-3" for="contactEmail">Email</label>' +
      '        <input id="contactEmail" class="form-control form-control-lg" type="email" ng-model="$ctrl.form.email" required />' +
      '        <label class="form-label mt-3" for="contactSubject">Subject</label>' +
      '        <input id="contactSubject" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.subject" required />' +
      '        <label class="form-label mt-3" for="contactMessage">Message</label>' +
      '        <textarea id="contactMessage" class="form-control" rows="7" ng-model="$ctrl.form.message" required></textarea>' +
      '        <p class="public-contact-form__status text-success mt-3 mb-0" ng-if="$ctrl.successMessage">{{$ctrl.successMessage}}</p>' +
      '        <p class="public-contact-form__status text-danger mt-3 mb-0" ng-if="$ctrl.errorMessage">{{$ctrl.errorMessage}}</p>' +
      '        <div class="public-hero__actions mt-4 mb-0">' +
      '          <button type="submit" class="btn btn-primary btn-lg" ng-disabled="$ctrl.isSubmitting || !$ctrl.canSubmit()">Send message</button>' +
      '        </div>' +
      '      </form>' +
      '    </article>' +
      '  </div>' +
      '</section>',
    controller: ContactPageController
  });

  ContactPageController.$inject = ['PublicContactService'];

  function ContactPageController(PublicContactService) {
    var $ctrl = this;

    $ctrl.$onInit = function onInit() {
      resetForm();
      $ctrl.isSubmitting = false;
      $ctrl.successMessage = '';
      $ctrl.errorMessage = '';
    };

    $ctrl.canSubmit = function canSubmit() {
      return isValidEmail($ctrl.form.email)
        && ($ctrl.form.name || '').trim().length >= 2
        && ($ctrl.form.subject || '').trim().length >= 3
        && ($ctrl.form.message || '').trim().length >= 10;
    };

    $ctrl.submit = function submit() {
      if (!$ctrl.canSubmit() || $ctrl.isSubmitting) {
        return;
      }

      $ctrl.isSubmitting = true;
      $ctrl.successMessage = '';
      $ctrl.errorMessage = '';

      PublicContactService.sendMessage({
        name: ($ctrl.form.name || '').trim(),
        email: ($ctrl.form.email || '').trim(),
        subject: ($ctrl.form.subject || '').trim(),
        message: ($ctrl.form.message || '').trim()
      }).then(function handleSuccess() {
        $ctrl.successMessage = 'Thanks, your message has been sent.';
        resetForm();
      }).catch(function handleError(error) {
        $ctrl.errorMessage = getErrorMessage(error, 'We could not send your message right now. Please try again later.');
      }).finally(function clearSubmittingState() {
        $ctrl.isSubmitting = false;
      });
    };

    function resetForm() {
      $ctrl.form = {
        name: '',
        email: '',
        subject: '',
        message: ''
      };
    }
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && error.data.message) {
      return error.data.message;
    }

    return fallbackMessage;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
  }
})();
