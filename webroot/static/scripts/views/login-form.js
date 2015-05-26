/**
 * BzDeck Log-in Form View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.LoginForm = function LoginFormView () {
  // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
  let params = new URLSearchParams(location.search.substr(1));

  this.host = params.get('server') === 'dev' ? 'mozilla-dev' : 'mozilla';
  this.$form = document.querySelector('#app-login [role="form"]');
  this.$statusbar = document.querySelector('#app-login [role="status"]');

  this.on('SessionController:StatusUpdate', data => {
    this.show_status(data.message);

    if (data.status === 'ForcingLogin') {
      this.show();
    }

    if (data.status === 'LoadingData') {
      this.hide();
      this.hide_intro();
    }
  }, true);

  this.on('SessionController:Error', data => {
    this.show_status(data.message);
  }, true);

  this.on('SessionController:Logout', data => {
    this.show();
  }, true);

  this.activate_bugzilla_auth();
  this.activate_qrcode_auth();
};

BzDeck.views.LoginForm.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.LoginForm.prototype.constructor = BzDeck.views.LoginForm;

BzDeck.views.LoginForm.prototype.show = function (firstrun = true) {
  this.$form.setAttribute('aria-hidden', 'false');
  this.$bzauth_button.focus();

  return !firstrun;
};

BzDeck.views.LoginForm.prototype.hide = function () {
  this.$form.setAttribute('aria-hidden', 'true');
};

BzDeck.views.LoginForm.prototype.hide_intro = function () {
  document.querySelector('#app-intro').style.display = 'none';
};

BzDeck.views.LoginForm.prototype.show_status = function (message) {
  this.$statusbar.textContent = message;
};

BzDeck.views.LoginForm.prototype.activate_bugzilla_auth = function () {
  this.$bzauth_button = this.$form.querySelector('[data-id="bugzilla-auth"]');

  this.$bzauth_button.addEventListener('click', event => {
    let callback = `${location.origin}/integration/bugzilla-auth-callback/`,
        auth_url = `${BzDeck.config.servers[this.host].url}/auth.cgi?callback=${callback}&description=BzDeck`;

    this.trigger(':LoginRequested', { 'host': this.host });

    // Take the user to the Bugzilla auth page
    // http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html
    window.open(auth_url, 'bugzilla-auth');
  });
};

BzDeck.views.LoginForm.prototype.activate_qrcode_auth = function () {
  this.$qrauth_button = this.$form.querySelector('[data-id="qrcode-auth"]');
  this.$qrauth_button.addEventListener('click', event => {
    let $overlay = document.querySelector('#qrcode-auth-overlay');

    let decode = () => {
      let qrcode = $overlay.querySelector('iframe').contentWindow.qrcode,
          $canvas = document.createElement('canvas'),
          context = $canvas.getContext('2d'),
          width = $canvas.width = $video.videoWidth,
          height = $canvas.height = $video.videoHeight;

      context.drawImage($video, 0, 0, width, height);
      qrcode.callback = result => this.trigger(':QRCodeDecoded', { 'host': this.host, result });
      qrcode.decode($canvas.toDataURL('image/png'));
    };

    let hide_overlay = () => {
      this.$qrauth_button.focus();
      $overlay.setAttribute('aria-hidden', 'true');
      $video.pause();
      stream.stop();
    };

    if ($overlay) {
      $overlay.removeAttribute('aria-hidden');
    } else {
      $overlay = document.body.appendChild(this.get_fragment('qrcode-auth-overlay-template').firstElementChild);
      $overlay.querySelector('video').addEventListener('click', event => { decode(); hide_overlay(); });
      $overlay.querySelector('[role="button"][data-id="cancel"]').addEventListener('click', event => hide_overlay());
    }

    let $video = $overlay.querySelector('video'),
        stream;

    navigator.mediaDevices.getUserMedia({ 'audio': false, 'video': true }).then(input => {
      stream = input;
      $video.src = URL.createObjectURL(stream);
      $video.play();
    });
  });
};
