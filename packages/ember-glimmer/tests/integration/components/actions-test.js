import { moduleFor, RenderingTest } from '../../utils/test-case';
import { set } from 'ember-metal/property_set';
import { Component } from '../../utils/helpers';
import assign from 'ember-metal/assign';

moduleFor('Components test: sendAction', class extends RenderingTest {

  constructor() {
    super();
    this.actionCounts = {};
    this.sendCount = 0;
    this.actionArguments = null;

    var self = this;

    this.registerComponent('action-delegate', {
      ComponentClass: Component.extend({
        init() {
          this._super();
          self.delegate = this;
        }
      })
    });
  }

  renderDelegate(template = '{{action-delegate}}', context = {}) {
    let root = this;
    context = assign(context, {
      send: function(actionName) {
        root.sendCount++;
        root.actionCounts[actionName] = root.actionCounts[actionName] || 0;
        root.actionCounts[actionName]++;
        root.actionArguments = Array.prototype.slice.call(arguments, 1);
      }
    });
    this.render(template, context);
  }

  assertSendCount(count) {
    this.assert.equal(this.sendCount, count, `Send was called ${count} time(s)`);
  }

  assertNamedSendCount(actionName, count) {
    this.assert.equal(this.actionCounts[actionName], count, `An action named '${actionName}' was sent ${count} times`);
  }

  assertSentWithArgs(expected, message = 'arguments were sent with the action') {
    this.assert.deepEqual(this.actionArguments, expected, message);
  }

  ['@test Calling sendAction on a component without an action defined does nothing']() {
    this.renderDelegate();

    this.runTask(() => this.delegate.sendAction());

    this.assertSendCount(0);
  }

  ['@test Calling sendAction on a component with an action defined calls send on the controller']() {
    this.renderDelegate();

    this.runTask(() => {
      set(this.delegate, 'action', 'addItem');
      this.delegate.sendAction();
    });

    this.assertSendCount(1);
    this.assertNamedSendCount('addItem', 1);
  }

  ['@test Calling sendAction on a component with a function calls the function']() {
    this.assert.expect(1);

    this.renderDelegate();

    this.runTask(() => {
      set(this.delegate, 'action', () => this.assert.ok(true, 'function is called'));
      this.delegate.sendAction();
    });
  }

  ['@test Calling sendAction on a component with a function calls the function with arguments']() {
    this.assert.expect(1);
    let argument = {};

    this.renderDelegate();

    this.runTask(() => {
      set(this.delegate, 'action', (actualArgument) => {
        this.assert.deepEqual(argument, actualArgument, 'argument is passed');
      });
      this.delegate.sendAction('action', argument);
    });
  }

  ['@glimmer Calling sendAction on a component with a reference attr calls the function with arguments']() {
    this.renderDelegate('{{action-delegate playing=playing}}', {
      playing: null
    });

    this.runTask(() => this.delegate.sendAction());

    this.assertSendCount(0);

    this.runTask(() => {
      set(this.context, 'playing', 'didStartPlaying');
      this.delegate.sendAction('playing');
    });

    this.assertSendCount(1);
    this.assertNamedSendCount('didStartPlaying', 1);
  }

  ['@htmlbars Calling sendAction on a component with a {{mut}} attr calls the function with arguments']() {
    this.renderDelegate('{{action-delegate playing=(mut playing)}}', {
      playing: null
    });

    this.runTask(() => this.delegate.sendAction('playing'));

    this.assertSendCount(0);

    this.runTask(() => this.delegate.attrs.playing.update('didStartPlaying'));
    this.runTask(() => this.delegate.sendAction('playing'));

    this.assertSendCount(1);
    this.assertNamedSendCount('didStartPlaying', 1);
  }

  ['@test Calling sendAction with a named action uses the component\'s property as the action name']() {
    this.renderDelegate();

    let component = this.delegate;

    this.runTask(() => {
      set(this.delegate, 'playing', 'didStartPlaying');
      component.sendAction('playing');
    });

    this.assertSendCount(1);
    this.assertNamedSendCount('didStartPlaying', 1);

    this.runTask(() => component.sendAction('playing'));

    this.assertSendCount(2);
    this.assertNamedSendCount('didStartPlaying', 2);

    this.runTask(() => {
      set(component, 'action', 'didDoSomeBusiness');
      component.sendAction();
    });

    this.assertSendCount(3);
    this.assertNamedSendCount('didDoSomeBusiness', 1);
  }

  ['@test Calling sendAction when the action name is not a string raises an exception']() {
    this.renderDelegate();

    this.runTask(() => {
      set(this.delegate, 'action', {});
      set(this.delegate, 'playing', {});
    });

    this.assert.throws(() => this.delegate.sendAction());
    this.assert.throws(() => this.delegate.sendAction('playing'));
  }

  ['@test Calling sendAction on a component with contexts']() {
    this.renderDelegate();

    let testContext = { song: 'She Broke My Ember' };
    let firstContext  = { song: 'She Broke My Ember' };
    let secondContext = { song: 'My Achey Breaky Ember' };

    this.runTask(() => {
      set(this.delegate, 'playing', 'didStartPlaying');
      this.delegate.sendAction('playing', testContext);
    });

    this.assertSendCount(1);
    this.assertNamedSendCount('didStartPlaying', 1);
    this.assertSentWithArgs([testContext], 'context was sent with the action');

    this.runTask(() => {
      this.delegate.sendAction('playing', firstContext, secondContext);
    });

    this.assertSendCount(2);
    this.assertNamedSendCount('didStartPlaying', 2);
    this.assertSentWithArgs([firstContext, secondContext], 'multiple contexts were sent to the action');
  }

});

moduleFor('Components test: sendAction to a closure action', class extends RenderingTest {

  ['@test action should be called']() {
    this.assert.expect(1);
    let component;

    let InnerComponent = Component.extend({
      init() {
        this._super(...arguments);
        component = this;
      }
    });

    let OuterComponent = Component.extend({
      outerSubmit: () => {
        this.assert.ok(true, 'outerSubmit called');
      }
    });

    this.registerComponent('inner-component', { ComponentClass: InnerComponent, template: 'inner' });
    this.registerComponent('outer-component', {
      ComponentClass: OuterComponent,
      template: '{{inner-component submitAction=(action outerSubmit)}}'
    });

    this.render('{{outer-component}}');

    this.runTask(() => component.sendAction('submitAction'));
  }

  ['@test contexts passed to sendAction are appended to the bound arguments on a closure action']() {
    let first = 'mitch';
    let second = 'martin';
    let third = 'matt';
    let fourth = 'wacky wycats';

    let innerComponent;
    let actualArgs;

    this.registerComponent('inner-component', {
      ComponentClass: Component.extend({
        init() {
          this._super(...arguments);
          innerComponent = this;
        }
      }),
      template: 'inner'
    });

    this.registerComponent('outer-component', {
      ComponentClass: Component.extend({
        third,
        actions: {
          outerSubmit() {
            actualArgs = [...arguments];
          }
        }
      }),
      template: `{{inner-component innerSubmit=(action (action "outerSubmit" "${first}") "${second}" third)}}`
    });

    this.render('{{outer-component}}');

    this.runTask(() => innerComponent.sendAction('innerSubmit', fourth));

    this.assert.deepEqual(actualArgs, [first, second, third, fourth], 'action has the correct args');
  }
});

moduleFor('Components test: send', class extends RenderingTest {
  ['@test sending to undefined actions triggers an error']() {
    this.assert.expect(2);

    let component;

    this.registerComponent('foo-bar', {
      ComponentClass: Component.extend({
        init() {
          this._super();
          component = this;
        },
        actions: {
          foo: (message) => {
            this.assert.equal('bar', message);
          }
        }
      })
    });

    this.render('{{foo-bar}}');

    this.runTask(() => component.send('foo', 'bar'));

    this.assert.throws(function () {
      component.send('baz', 'bar');
    }, /had no action handler for: baz/);
  }

  ['@test `send` will call send from a target if it is defined']() {
    let component;
    let target = {
      send: (message, payload) => {
        this.assert.equal('foo', message);
        this.assert.equal('baz', payload);
      }
    };

    this.registerComponent('foo-bar', {
      ComponentClass: Component.extend({
        init() {
          this._super();
          component = this;
        },
        target: target
      })
    });

    this.render('{{foo-bar}}');

    this.runTask(() => component.send('foo', 'baz'));
  }
});
