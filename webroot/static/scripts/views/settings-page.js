/**
 * BzDeck Settings Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.SettingsPage = function SettingsPageView (tab_id, prefs) {
  // Activate tabs
  this.$$tablist = new this.widget.TabList(document.querySelector('#settings-tablist'));

  if (tab_id) {
    this.$$tablist.view.selected = this.$$tablist.view.$focused = document.querySelector(`#settings-tab-${tab_id}`);
  }

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  for (let [name, value] of prefs) {
    this.activate_radiogroup(name, value);
  }

  // Show the QR code for mobile
  this.show_qrcode();
};

BzDeck.views.SettingsPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.SettingsPage.prototype.constructor = BzDeck.views.SettingsPage;

BzDeck.views.SettingsPage.prototype.activate_radiogroup = function (name, _value) {
  let $root = document.documentElement,
      $rgroup = document.querySelector(`#tabpanel-settings [data-pref="${name}"]`),
      value = _value.user !== undefined ? _value.user : _value.default,
      attr = 'data-' + name.replace(/[\._]/g, '-');

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
  }

  (new this.widget.RadioGroup($rgroup)).bind('Selected', event => {
    value = event.detail.items[0].dataset.value;
    value = _value.type === 'boolean' ? value === 'true' : value;
    this.trigger(':PrefValueChanged', { name, value });

    if ($root.hasAttribute(attr)) {
      $root.setAttribute(attr, String(value));
    }
  });
};

BzDeck.views.SettingsPage.prototype.show_qrcode = function () {
  let $outer = document.querySelector('#settings-qrcode-outer');

  // Because the QRCode library doesn't support the strict mode, load the script in an iframe
  $outer.querySelector('iframe').addEventListener('load', event => {
    let QRCode = event.target.contentWindow.QRCode;

    new QRCode($outer.querySelector('div'), {
      'text': `${BzDeck.models.account.data.name}|${BzDeck.models.account.data.api_key}`,
      'width': 256,
      'height': 256,
      'colorLight': 'transparent',
    });
  });
};
