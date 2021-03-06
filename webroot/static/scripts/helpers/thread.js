/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.helpers.Thread = function ThreadHelper () {};

BzDeck.helpers.Thread.prototype = Object.create(BzDeck.helpers.Base.prototype);
BzDeck.helpers.Thread.prototype.constructor = BzDeck.helpers.Thread;

BzDeck.helpers.Thread.prototype.onselect = function (event) {
  let ids = event.detail.ids;

  if (ids.length) {
    // Show the bug in the preview pane or a new tab
    this.consumer.controller.data.preview_id = Number.parseInt(ids[ids.length - 1]);
  }
};

BzDeck.helpers.Thread.prototype.ondblclick = function (event, selector) {
  let $target = event.originalTarget;

  if ($target.matches(selector)) {
    // Open Bug in New Tab
    BzDeck.router.navigate('/bug/' + $target.dataset.id, { 'ids': [...this.consumer.controller.data.bugs.keys()] });
  }
};

/* ------------------------------------------------------------------------------------------------------------------
 * Classic Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.helpers.ClassicThread = function ClassicThreadHelper (consumer, name, $grid, options) {
  let default_cols = BzDeck.config.grid.default_columns,
      columns = BzDeck.prefs.get(`${name}.list.columns`) || default_cols,
      field = BzDeck.models.server.data.config.field;

  let toggle_prop = prop => {
    for (let $item of this.$$grid.view.selected) {
      let _data = this.$$grid.data.rows[$item.sectionRowIndex].data;

      _data[prop] = _data[prop] !== true;
    }
  };

  this.consumer = consumer;
  this.bugs = [];

  this.$$grid = new this.widget.Grid($grid, {
    'rows': [],
    'columns': columns.map(col => {
      // Add labels
      col.label = [for (_col of default_cols) if (_col.id === col.id) _col.label][0] ||
                  field[col.id].description;

      return col;
    })
  }, options);

  this.$$grid.bind('Selected', event => this.onselect(event));
  this.$$grid.bind('dblclick', event => this.ondblclick(event, '[role="row"]'));
  this.$$grid.bind('Sorted', event => BzDeck.prefs.set(`${name}.list.sort_conditions`, event.detail.conditions));

  this.$$grid.bind('ColumnModified', event => {
    BzDeck.prefs.set(`${name}.list.columns`, event.detail.columns.map(col => ({
      'id': col.id,
      'type': col.type || 'string',
      'hidden': col.hidden || false
    })));
  });

  this.$$grid.assign_key_bindings({
    // Show previous bug, an alias of UP
    'B': event => FlareTail.util.kbd.dispatch($grid, 'ArrowUp'),
    // Show next bug, an alias of DOWN
    'F': event => FlareTail.util.kbd.dispatch($grid, 'ArrowDown'),
    // Toggle read
    'M': event => toggle_prop('unread'),
    // Toggle star
    'S': event => toggle_prop('starred'),
  });

  this.on('BugModel:AnnotationUpdated', data => {
    let $row = $grid.querySelector(`[role="row"][data-id="${data.bug.id}"]`);

    if ($row) {
      $row.setAttribute(`data-${data.type}`, data.value);

      if (data.type === 'starred') {
        $row.querySelector('[data-id="starred"] [role="checkbox"]').setAttribute('aria-checked', data.value);
      }
    }
  }, true);
};

BzDeck.helpers.ClassicThread.prototype = Object.create(BzDeck.helpers.Thread.prototype);
BzDeck.helpers.ClassicThread.prototype.constructor = BzDeck.helpers.ClassicThread;

BzDeck.helpers.ClassicThread.prototype.update = function (bugs) {
  this.bugs = bugs;

  this.$$grid.build_body([...bugs.values()].map(bug => {
    let row = {
      'id': `${this.$$grid.view.$container.id}-row-${bug.id}`,
      'data': {},
      'dataset': {
        'unread': bug.unread === true,
        'severity': bug.severity
      }
    };

    for (let column of this.$$grid.data.columns) {
      let field = column.id,
          value = bug[field];

      if (!value) {
        value = '';
      }

      if (Array.isArray(value)) {
        if (field === 'mentors') { // Array of Person
          value = [for (name of bug[field]) BzDeck.collections.users.get(name, { name }).name].join(', ');
        } else { // Keywords
          value = value.join(', ');
        }
      }

      if (typeof value === 'object' && !Array.isArray(value)) { // Person
        value = BzDeck.collections.users.get(value.name, { 'name': value.name }).name;
      }

      if (field === 'starred') {
        value = bug.starred;
      }

      if (field === 'unread') {
        value = value === true;
      }

      row.data[field] = value;
    }

    row.data = new Proxy(row.data, {
      'set': (obj, prop, value) => {
        if (prop === 'starred') {
          bug.starred = value;
        }

        if (prop === 'unread') {
          bug.unread = value;

          let row = [for (row of this.$$grid.data.rows) if (row.data.id === obj.id) row][0];

          if (row && row.$element) {
            row.$element.dataset.unread = value;
          }
        }

        obj[prop] = value;

        return true;
      }
    });

    return row;
  }));
};

BzDeck.helpers.ClassicThread.prototype.filter = function (bugs) {
  this.$$grid.filter([...bugs.keys()]);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Vertical Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.helpers.VerticalThread = function VerticalThreadHelper (consumer, name, $outer, options) {
  let mobile = FlareTail.util.ua.device.mobile;

  this.consumer = consumer;
  this.name = name;
  this.options = options;

  this.$outer = $outer;
  this.$listbox = $outer.querySelector('[role="listbox"]');
  this.$$listbox = new this.widget.ListBox(this.$listbox, []);
  this.$option = this.get_fragment('vertical-thread-item').firstElementChild;
  this.$$scrollbar = new this.widget.ScrollBar($outer);
  this.$scrollable_area = mobile ? $outer.querySelector('.scrollable-area-content') : $outer;

  this.$$listbox.bind('dblclick', event => this.ondblclick(event, '[role="option"]'));
  this.$$listbox.bind('Selected', event => {
    if (!event.detail.ids.length) {
      return;
    }

    this.onselect(event);

    // Create a marquee effect when the bug title is overflowing
    for (let $option of event.detail.items) {
      let $name = $option.querySelector('[itemprop="name"]'),
          width = $name.scrollWidth;

      if (width > $name.clientWidth) {
        let name = `${$option.id}-name-marquee`,
            sheet = document.styleSheets[1],
            index = [for (r of Iterator(sheet.cssRules)) if (r[1].type === 7 && r[1].name === name) r[0]][0];

        // Delete the rule first in case of any width changes
        if (index) {
          sheet.deleteRule(index);
        }

        sheet.insertRule(`@keyframes ${name} { 0%, 10% { text-indent: 0 } 100% { text-indent: -${width+10}px } }`, 0);
        $name.style.setProperty('animation-name', name);
        $name.style.setProperty('animation-duration', `${width/25}s`);
      }
    }
  });

  this.$$listbox.assign_key_bindings({
    // Show previous bug, an alias of UP
    'B': event => FlareTail.util.kbd.dispatch(this.$listbox, 'ArrowUp'),
    // Show next bug, an alias of DOWN
    'F': event => FlareTail.util.kbd.dispatch(this.$listbox, 'ArrowDown'),
    // Toggle read
    'M': event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.collections.bugs.get(Number($item.dataset.id)).unread = $item.dataset.unread === 'false';
      }
    },
    // Toggle star
    'S': event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.collections.bugs.get(Number($item.dataset.id))
                          .starred = $item.querySelector('[data-field="starred"]').matches('[aria-checked="false"]');
      }
    },
    // Open the bug in a new tab
    'O|Enter': event => {
      BzDeck.router.navigate('/bug/' + this.consumer.controller.data.preview_id,
                             { 'ids': [...this.consumer.controller.data.bugs.keys()] });
    },
  });

  this.on('BugModel:AnnotationUpdated', data => {
    let $option = this.$listbox.querySelector(`[role="option"][data-id="${data.bug.id}"]`);

    if ($option) {
      $option.setAttribute(`data-${data.type}`, data.value);

      if (data.type === 'starred') {
        $option.querySelector('[data-field="starred"]').setAttribute('aria-checked', data.value);
      }
    }
  }, true);

  // Lazy loading while scrolling
  this.$scrollable_area.addEventListener('scroll', event => {
    if (this.unrendered_bugs.length && event.target.scrollTop === event.target.scrollTopMax) {
      FlareTail.util.event.async(() => this.render());
    }
  });
};

BzDeck.helpers.VerticalThread.prototype = Object.create(BzDeck.helpers.Thread.prototype);
BzDeck.helpers.VerticalThread.prototype.constructor = BzDeck.helpers.VerticalThread;

BzDeck.helpers.VerticalThread.prototype.update = function (bugs) {
  let cond = this.options.sort_conditions;

  this.unrendered_bugs = cond ? FlareTail.util.array.sort([...bugs.values()], cond) : [...bugs.values()];
  this.$outer.setAttribute('aria-busy', 'true');
  this.$listbox.innerHTML = '';

  FlareTail.util.event.async(() => {
    this.render();
    this.$listbox.dispatchEvent(new CustomEvent('Updated'));
    this.$outer.removeAttribute('aria-busy');
    this.$scrollable_area.scrollTop = 0;
  });
};

BzDeck.helpers.VerticalThread.prototype.render = function () {
  let $fragment = new DocumentFragment();

  for (let bug of this.unrendered_bugs.splice(0, 50)) {
    // TODO: combine primary participants' avatars/initials (#124)
    let contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;

    let $option = $fragment.appendChild(this.fill(this.$option.cloneNode(true), {
      'id': bug.id,
      'name': bug.summary,
      'dateModified': bug.last_change_time,
      'contributor': BzDeck.collections.users.get(contributor, { 'name': contributor }).properties,
    }, {
      'id': `${this.name}-vertical-thread-bug-${bug.id}`,
      'data-id': bug.id,
      'data-unread': !!bug.unread,
      'aria-checked': bug.starred,
    }));
  }

  this.$listbox.appendChild($fragment);
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
  this.$$scrollbar.set_height();
};
