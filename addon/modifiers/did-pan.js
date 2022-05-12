import Modifier from 'ember-modifier';
import { parseInitialTouchData, parseTouchData, isHorizontal, isVertical } from '../utils/parse-touch-data';
import { action } from '@ember/object';

const _fn = () => {};

export default class DidPanModifier extends Modifier {
  threshold;
  axis;
  capture;
  passive;
  preventScroll;
  element;
  currentTouches = new Map();

  get options() {
    return {
      capture: this.capture,
      passive: this.passive
    };
  }

  addEventListeners(element) {
    this.element = element;
    // if an axis is set, limit scroll to a single axis
    if(this.axis === 'horizontal'){
      this.element.style.touchAction = 'pan-y';
    } else if(this.axis === 'vertical') {
      this.element.style.touchAction = 'pan-x';
    }

    this.element.addEventListener('touchstart', this.didTouchStart, this.options);
    this.element.addEventListener('touchmove', this.didTouchMove, { capture: this.useCapture });
    this.element.addEventListener('touchend', this.didTouchEnd, this.options);
    this.element.addEventListener('touchcancel', this.didTouchEnd, this.options);
  }

  removeEventListeners(element) {
    element.style.touchAction = null;

    element.removeEventListener('touchstart', this.didTouchStart, this.options);
    element.removeEventListener('touchmove', this.didTouchMove, { capture: this.useCapture });
    element.removeEventListener('touchend', this.didTouchEnd, this.options);
    element.removeEventListener('touchcancel', this.didTouchEnd, this.options);
  }

  @action
  didTouchStart(e){
    for(const touch of e.changedTouches){
      const touchData = parseInitialTouchData(touch, e);

      this.currentTouches.set(touch.identifier, touchData);
    }
  }

  @action
  didTouchMove(e){
    for(const touch of e.changedTouches){
      const previousTouchData = this.currentTouches.get(touch.identifier);
      const touchData = parseTouchData(previousTouchData, touch, e);

      if(touchData.panStarted){
        // prevent scroll if a pan is still busy
        if(this.preventScroll){
          e.preventDefault();
        }

        this.didPan(touchData.data);
      } else {
        // only pan when the threshold for the given axis is achieved
        if(
          !touchData.panDenied
          && (
            (this.axis === 'horizontal' && Math.abs(touchData.data.current.distanceX) > this.threshold)
            || (this.axis === 'vertical' && Math.abs(touchData.data.current.distanceY) > this.threshold)
          )
        ){
          // test if axis matches with data else deny the pan
          if(  (this.axis === 'horizontal' && isHorizontal(touchData))
            || (this.axis === 'vertical' && isVertical(touchData))
          ){
            // prevent scroll if a pan is detected
            if(this.preventScroll){
              e.preventDefault();
            }

            touchData.panStarted = true;

            // trigger panStart hook
            this.didPanStart(touchData.data);
          } else {
            touchData.panDenied = true;
          }
        }
      }

      this.currentTouches.set(touch.identifier, touchData);
    }
  }

  @action
  didTouchEnd(e){
    for(const touch of e.changedTouches){
      const previousTouchData = this.currentTouches.get(touch.identifier);
      const touchData = parseTouchData(previousTouchData, touch, e);

      if(touchData.panStarted){
        this.didPanEnd(touchData.data);
      }

      this.currentTouches.delete(touch.identifier);
    }
  }

  modify(element, positional, named) {
    this.threshold = named.threshold ?? 10;
    this.axis = named.axis ?? 'horizontal';
    this.capture = named.capture ?? false;
    this.passive = named.passive ?? true;
    this.preventScroll = named.preventScroll ?? true;

    this.didPanStart = named.onPanStart ?? _fn;
    this.didPan = named.onPan ?? _fn;
    this.didPanEnd = named.onPanEnd ?? _fn;

    this.removeEventListeners(element);
    this.addEventListeners(element);
  }

  willRemove() {
    this.removeEventListeners();
    this.currentTouches.clear();
  }
}
