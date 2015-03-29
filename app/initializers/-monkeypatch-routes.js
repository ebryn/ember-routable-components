import Ember from 'ember';

function initialize() {
  Ember.Route.reopen({
    model(params, transition) {
      var parentRoute = transition && transition.state.handlerInfos[transition.resolveIndex - 1];
      var parentModel = parentRoute && parentRoute.context;
      return parentModel;
    },

    attributes(params, transition) {
      return {
        model: this.model(params, transition)
      };
    },

    generateController() {
      return Ember.Controller.create();
    },

    render(_name, options) {
      var into = options && options.into && options.into.replace(/\//g, '.');
      var outlet = (options && options.outlet) || 'main';
      var name = _name || this.routeName;
      var componentLookup = this.container.lookup('component-lookup:main');
      var Component = componentLookup.lookupFactory(name);
      var ViewClass;
      if (!Component) {
        Component = componentLookup.lookupFactory(name + '-route');
      }
      if (!Component) {
        ViewClass = this.container.lookupFactory('view:' + name);
      }

      this.connections.push({
        into: into,
        outlet: outlet,
        name: name,
        // controller: name,
        attributes: this.__attributes__,
        // params: params,
        ViewClass: Component || ViewClass,
        template: (!Component) ? this.container.lookup('template:' + name) : undefined
      });

      Ember.run.once(this.router, '_setOutlets');
    },

    deserialize(params, transition) {
      var attributes = this.attributes(this.paramsFor(this.routeName), transition);
      this.__attributes__ = attributes;
      return Ember.RSVP.resolve(attributes.model).then(function(model) {
        attributes.model = model;
        return model;
      });
    }
  });

  Ember.OutletView.reopen({
    _buildView(state) {
      if (!state) { return; }

      // var LOG_VIEW_LOOKUPS = property_get.get(this, 'namespace.LOG_VIEW_LOOKUPS');
      var view;
      var render = state.render;
      var ViewClass = render.ViewClass;
      var isDefaultView = false;

      if (!ViewClass) {
        isDefaultView = true;
        ViewClass = this.container.lookupFactory(this._isTopLevel ? 'view:toplevel' : 'view:default');
      }

      view = ViewClass.create({
        _debugTemplateName: render.name,
        renderedName: render.name,
        controller: render.controller,
        attrs: render.attributes,
        modelBinding: "attrs.model"
      });

      if (!Ember.Component.detect(view) && !Ember.get(view, 'template')) {
        view.set('template', render.template);
      }

      // if (LOG_VIEW_LOOKUPS) {
      //   Ember.Logger.info("Rendering " + render.name + " with " + (render.isDefaultView ? "default view " : "") + view, { fullName: 'view:' + render.name });
      // }

      return view;
    }
  });

  Ember.Component.reopen({
    sendAction: function (action) {
      for (var _len = arguments.length, contexts = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        contexts[_key - 1] = arguments[_key];
      }

      var actionName;

      // Send the default action
      if (action === undefined) {
        actionName = Ember.get(this, "action");
        Ember.assert("The default action was triggered on the component " + this.toString() + ", but the action name (" + actionName + ") was not a string.", Ember.isNone(actionName) || typeof actionName === "string");
      } else {
        actionName = this.attrs && this.attrs[action] || Ember.get(this, action);
        Ember.assert("The " + action + " action was triggered on the component " + this.toString() + ", but the action name (" + actionName + ") was not a string.", Ember.isNone(actionName) || typeof actionName === "string");
      }

      // If no action name for that action could be found, just abort.
      if (actionName === undefined) {
        return;
      }

      this.triggerAction({
        action: actionName,
        actionContext: contexts
      });
    }
  });
  var HTMLBarsEnv = Ember.__loader.require('ember-htmlbars/env')['default'];
  var HTMLBarsHooks = HTMLBarsEnv.hooks;
  var lookupHelper = Ember.__loader.require('ember-htmlbars/system/lookup-helper')['default'];
  var StreamUtils = Ember.__loader.require('ember-metal/streams/utils');

  function attrSubscribe(attrs, key, stream) {
    stream.subscribe(function(newStream) {
      Ember.set(attrs, key, StreamUtils.read(newStream));
    });
  }

  HTMLBarsHooks.component = function component(env, morph, view, tagName, attrs, template) {
    var helper = lookupHelper(tagName, view, env);
    var attrsObj = {};
    var currentValue;
    for (var key in attrs) {
      if (!attrs.hasOwnProperty(key)) { continue; }
      currentValue = attrs[key];
      if (StreamUtils.isStream(currentValue)) {
        attrsObj[key] = StreamUtils.read(currentValue);
        // TODO: hooks & teardown
        attrSubscribe(attrsObj, key, currentValue);
      } else {
        attrsObj[key] = currentValue;
      }
    }

    Ember.assert("You specified `" + tagName + "` in your template, but a component for `" + tagName + "` could not be found.", !!helper);

    return helper.helperFunction.call(undefined, [], {attrs: attrsObj}, { morph: morph, template: template }, env);
  };
}

export default {
  name: 'ember-routable-components-monkeypatch',
  initialize: initialize
};
