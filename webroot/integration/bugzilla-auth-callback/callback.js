/**
 * Bugzilla authentication callback handler
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

// Once the user is redirected back, notify the auth info and close the window.
// See http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html for details.
window.addEventListener('DOMContentLoaded', event => {
  let params = new URLSearchParams(location.search.substr(1));

  new BroadcastChannel('BugzillaAuthCallback').postMessage({
    'email': params.get('client_api_login'),
    'key': params.get('client_api_key'),
  });

  window.close();
});
