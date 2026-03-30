(function () {
  'use strict';

  angular.module('morningBriefingApp').component('homePage', {
    template:
      '<section class="public-page public-page--home">' +
      '  <div class="public-hero">' +
      '    <div class="public-hero__content">' +
      '      <span class="public-page__eyebrow">Daily Briefing</span>' +
      '      <h1>Daily Briefing for calmer mornings</h1>' +
      '      <p class="public-page__lead">Bring together your weather, calendars, inbox, tasks, and news into one clear view so your day starts with context instead of clutter.</p>' +
      '      <div class="public-hero__actions">' +
      '        <button type="button" class="btn btn-primary btn-lg" ng-click="$ctrl.signIn()">Sign in</button>' +
      '        <a class="btn btn-outline-light btn-lg" href="#/privacy">Read privacy policy</a>' +
      '      </div>' +
      '      <div class="public-page__meta">' +
      '        <span>Private by design</span>' +
      '        <span>Tenant-aware dashboards</span>' +
      '        <span>Audio briefings included</span>' +
      '      </div>' +
      '    </div>' +
      '    <div class="public-hero__visual">' +
      '      <div class="public-shot-card public-shot-card--primary">' +
      '        <img ng-src="./assets/img/daily-briefing-screenshot-1.png" alt="Daily Briefing dashboard overview" />' +
      '      </div>' +
      '      <div class="public-shot-card public-shot-card--secondary">' +
      '        <img ng-src="./assets/img/daily-briefing-screenshot-2.png" alt="Daily Briefing widgets and layout" />' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <section class="public-section">' +
      '    <div class="public-section__heading">' +
      '      <span class="public-page__eyebrow">What it does</span>' +
      '      <h2>One place for your daily signal</h2>' +
      '    </div>' +
      '    <div class="public-grid">' +
      '      <article class="public-card">' +
      '        <h3>Personal dashboard</h3>' +
      '        <p>Arrange the widgets that matter most and shape a briefing that matches how you actually plan your day.</p>' +
      '      </article>' +
      '      <article class="public-card">' +
      '        <h3>Connected sources</h3>' +
      '        <p>Pull in tasks, calendars, email, RSS feeds, and weather snapshots through authenticated integrations.</p>' +
      '      </article>' +
      '      <article class="public-card">' +
      '        <h3>Readable summaries</h3>' +
      '        <p>Turn raw updates into concise briefings, including optional audio output for hands-free catch-up.</p>' +
      '      </article>' +
      '    </div>' +
      '  </section>' +
      '</section>',
    controller: HomePageController
  });

  HomePageController.$inject = ['AuthService'];

  function HomePageController(AuthService) {
    this.signIn = function signIn() {
      AuthService.beginSignIn('/dashboard');
    };
  }
})();
