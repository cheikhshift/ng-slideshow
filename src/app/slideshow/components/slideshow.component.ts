import {
  AfterViewChecked,
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, NgZone, Output,
  ViewEncapsulation
} from '@angular/core';
import {Store} from '@ngrx/store';
import * as Immutable from 'immutable';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {AppState} from '../models/state.model';
import {SWIPE_ACTION} from '../enums/swipe-action.enum';
import {DOM_CLASSES} from '../enums/dom-classes.enum';
import {SLIDE_DIRECTION} from '../enums/slide-direction.enum';
import {EVENT} from '../enums/slideshow-event.enum';
import {SlideshowEvent} from '../models/slideshow-event.model';
import {READY, SLIDING} from '../reducers/loading-state.reducer';
import {DECREMENT, INCREMENT, RESET} from '../reducers/offset-state.reducer';

@Component({
  selector: 'ng-slideshow',
  templateUrl: './slideshow.component.html',
  styleUrls: ['./slideshow.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlideshowComponent implements AfterViewChecked {

  /**
   * The immutable list of images
   *
   *@type {Immutable.List<any>}
   */
  @Input() images: Immutable.List<any>;

  /**
   * Configurable options for the slideshow
   *
   * @type {Immutable.List<any>}
   */
  @Input() options: Immutable.Map<any, any> = Immutable.Map();

  /**
   * Event dispatcher
   *
   * @type {EventEmitter<SlideshowEvent>}
   */
  @Output() eventDispatcher: EventEmitter<SlideshowEvent> = new EventEmitter<SlideshowEvent>();

  /**
   * Offset state subscription
   *
   * @type any
   */
  private offsetStateSubscription: any;

  /**
   * Loading state subscription
   *
   * @type any
   */
  private loadingStateSubscription: any;

  /**
   * Offset status
   *
   * @type number
   */
  private offsetStatus: number;

  /**
   * Loading status
   *
   * @type string
   */
  private loadingStatus: string;

  /**
   * Thumbnail offset
   *
   * @type number
   */
  private thumbnailOffset = 0;

  /**
   * A list of DOM Elements
   *
   * @type Array<any>
   */
  private domElements: Array<any> = [];

  /**
   * @constructor
   * @param domSanitizer
   * @param store
   * @param elementRef
   * @param zone
   */
  constructor(private domSanitizer: DomSanitizer,
              private store: Store<AppState>,
              private elementRef: ElementRef,
              private zone: NgZone) {
    this.offsetStateSubscription = this.store.select('index');
    this.loadingStateSubscription = this.store.select('state');
    this.loadingStateSubscription.subscribe((appState) => {
      this.loadingStatus = appState;
      this.eventDispatcher.emit({label: EVENT.LOADING, metadata: this.loadingStatus});
    });
    this.offsetStateSubscription.subscribe((appState) => {
      this.offsetStatus = appState;
      this.eventDispatcher.emit({label: EVENT.OFFSET, metadata: this.loadingStatus});
    });
  }

  /**
   * After view is checked event
   *
   * @returns {void}
   */
  ngAfterViewChecked(): void {
    this.initializeThumbnailContainer();
  }

  /**
   * Moves a slide outside of the Angular Zone
   *
   * @param direction
   * @param evt
   * @returns {void}
   */
  moveSlide(direction: string = 'next', evt?): void {
    if (evt) {
      evt.preventDefault();
    }

    this.zone.runOutsideAngular(() => this.slide(direction));
  }

  /**
   * Slides an Element given a direction
   *
   * @param direction
   * @returns {void}
   */
  slide(direction: string = 'next') {
    const activeElement = this.elementRef.nativeElement.querySelector('li.' + DOM_CLASSES.ACTIVE);
    const slideElement = direction === SLIDE_DIRECTION.NEXT ?
      activeElement.nextElementSibling : activeElement.previousElementSibling;

    if (!slideElement || this.loadingStatus === SLIDING) {
      return;
    }

    this.loadingStateSubscription.dispatch({type: SLIDING});
    this.offsetStateSubscription.dispatch({type: direction === SLIDE_DIRECTION.NEXT ? INCREMENT : DECREMENT});

    activeElement.classList.remove(DOM_CLASSES.ACTIVE);
    activeElement.classList
      .add(direction === SLIDE_DIRECTION.NEXT ? DOM_CLASSES.SLIDE_OUT_LEFT : DOM_CLASSES.SLIDE_OUT_RIGHT);
    slideElement.classList.add(DOM_CLASSES.ACTIVE, DOM_CLASSES.SLIDE_IN);

    this.eventDispatcher.emit({label: SLIDE_DIRECTION.NEXT ? EVENT.SLIDE_NEXT : EVENT.SLIDE_PREVIOUS});
  }

  /**
   * On the active element transition end event
   *
   * @param evt
   * @returns void
   */
  onActiveTransitionEnd(evt) {
    this.zone.runOutsideAngular(() => this.clearActiveElement(evt.currentTarget));
  }

  /**
   * Clears the current active element
   *
   * @param target
   * @returns {void}
   */
  clearActiveElement(target: HTMLElement): void {
    if (!target.classList.contains('active')) {
      return;
    }

    const activeElement = this.elementRef.nativeElement.querySelector('.' + DOM_CLASSES.ACTIVE);
    const nextElement = activeElement.nextElementSibling;
    const previousElement = activeElement.previousElementSibling;

    activeElement.classList.remove(
      DOM_CLASSES.SLIDE_IN,
      DOM_CLASSES.LEFT,
      DOM_CLASSES.RIGHT,
      DOM_CLASSES.SLIDE_OUT_LEFT,
      DOM_CLASSES.SLIDE_OUT_RIGHT
    );

    if (previousElement) {
      previousElement.classList.add(DOM_CLASSES.LEFT);
      previousElement.classList.remove(
        DOM_CLASSES.SLIDE_IN,
        DOM_CLASSES.RIGHT,
        DOM_CLASSES.SLIDE_OUT_LEFT,
        DOM_CLASSES.SLIDE_OUT_RIGHT
      );
    }

    if (nextElement) {
      nextElement.classList.add(DOM_CLASSES.RIGHT);
      nextElement.classList.remove(
        DOM_CLASSES.SLIDE_IN,
        DOM_CLASSES.LEFT,
        DOM_CLASSES.SLIDE_OUT_LEFT,
        DOM_CLASSES.SLIDE_OUT_RIGHT
      );
    }

    this.loadingStateSubscription.dispatch({type: READY});
    this.eventDispatcher.emit({label: EVENT.ACTIVE_TRANSITION_COMPLETE});
  }

  /**
   * On swipe events
   *
   * @param action
   * @returns void
   */
  swipe(action = SWIPE_ACTION.RIGHT): void {
    if (action === SWIPE_ACTION.RIGHT) {
      this.moveSlide(SLIDE_DIRECTION.PREVIOUS);
    } else if (action === SWIPE_ACTION.LEFT) {
      this.moveSlide(SLIDE_DIRECTION.NEXT);
    }

    this.eventDispatcher.emit({label: action === SWIPE_ACTION.RIGHT ? EVENT.SWIPE_NEXT : EVENT.SWIPE_PREVIOUS});
  }

  /**
   * Returns a HTML Element
   *
   * @param selector
   * @param single
   * @returns {any}
   */
  getDomElement(selector: string, single: boolean = true) {
    let elem = this.domElements.find((domElement) => domElement.selector === selector);

    if (!elem) {
      elem = single ? this.elementRef.nativeElement.querySelector(selector)
        : this.elementRef.nativeElement.querySelectorAll(selector);
      this.domElements.push({selector: elem});
    }

    return elem;
  }

  /**
   * Sets an element to the left
   *
   * @param elem
   * @returns {void}
   */
  moveLeft(elem) {
    elem.classList.remove(DOM_CLASSES.RIGHT, DOM_CLASSES.ACTIVE);
    elem.classList.add(DOM_CLASSES.LEFT);
    this.eventDispatcher.emit({label: EVENT.MOVE_LEFT});
  }

  /**
   * Sets an element to the right
   *
   * @param elem
   * @returns {void}
   */
  moveRight(elem) {
    elem.classList.remove(DOM_CLASSES.LEFT, DOM_CLASSES.ACTIVE);
    elem.classList.add(DOM_CLASSES.RIGHT);
    this.eventDispatcher.emit({label: EVENT.MOVE_RIGHT});
  }

  /**
   * Slides an element to the left
   *
   * @param elem
   * @returns {void}
   */
  slideLeft(elem) {
    elem.classList.add(DOM_CLASSES.ACTIVE);
    elem.classList.remove(DOM_CLASSES.ACTIVE);
    elem.classList.add(DOM_CLASSES.SLIDE_OUT_LEFT);
    this.eventDispatcher.emit({label: EVENT.SLIDE_LEFT});
  }

  /**
   * Slides an element to the right
   *
   * @param elem
   * @returns {void}
   */
  slideRight(elem) {
    elem.classList.add(DOM_CLASSES.ACTIVE);
    elem.classList.remove(DOM_CLASSES.ACTIVE);
    elem.classList.add(DOM_CLASSES.SLIDE_OUT_RIGHT);
    this.eventDispatcher.emit({label: EVENT.SLIDE_RIGHT});
  }

  /**
   * Slides in an element
   *
   * @param elem
   * @returns {void}
   */
  slideIn(elem) {
    elem.classList.add(DOM_CLASSES.ACTIVE, DOM_CLASSES.SLIDE_IN);
    this.eventDispatcher.emit({label: EVENT.SLIDE_IN});
  }

  /**
   * Show an element given its index
   *
   * @param index
   * @returns void
   */
  showByIndex(index: number): void {
    this.zone.runOutsideAngular(() => this.slideInElementByIndex(index));
  }

  /**
   * Slides in an element given its index
   *
   * @param index
   * @returns {void}
   */
  slideInElementByIndex(index: number): void {
    const list = this.getDomElement('li', false);
    const currentIndex = this.offsetStatus;

    for (let i = 0; i < index; i++) {
      this.moveLeft(list[i]);
    }

    for (let i = index + 1; i < list.length; i++) {
      this.moveRight(list[i]);
    }

    if (index > currentIndex) {
      this.offsetStateSubscription.dispatch({type: RESET});
      for (let i = 0; i < index; i++) {
        this.offsetStateSubscription.dispatch({type: INCREMENT});
      }
      this.replaceActiveElement(list[currentIndex], list[index], SLIDE_DIRECTION.LEFT);
    } else {
      for (let i = currentIndex; i > index; i--) {
        this.offsetStateSubscription.dispatch({type: DECREMENT});
      }
      this.replaceActiveElement(list[currentIndex], list[index]);
    }

    this.eventDispatcher.emit({label: EVENT.SLIDE_IN_BY_INDEX, metadata: {index: index}});
  }

  /**
   * Replaces current active element
   *
   * @param activeElement
   * @param replacementElement
   * @param direction
   * @returns {void}
   */
  replaceActiveElement(activeElement: HTMLElement,
                       replacementElement: HTMLElement,
                       direction: string = SLIDE_DIRECTION.RIGHT): void {
    if (direction === SLIDE_DIRECTION.RIGHT) {
      this.slideRight(activeElement);
    } else {
      this.slideLeft(activeElement);
    }

    this.slideIn(replacementElement);
  }

  /**
   * Initializes the thumbnails container
   *
   * @returns {void}
   */
  initializeThumbnailContainer() {
    const parent = this.elementRef.nativeElement.querySelector('.thumbnails');
    const container = parent.querySelector('ul');
    const containerWidth = container.offsetWidth;
    const totalImages = this.images.count();
    const numElements = Math.ceil(containerWidth / this.options.get('thumbnailWidth'));

    if (totalImages > numElements) {
      parent.classList.remove('no-scroll-right');
    } else {
      parent.classList.add('no-scroll-right');
    }
  }

  /**
   * Slides thumbnails to a given direction
   *
   * @param container
   * @param direction
   * @returns {void}
   */
  slideThumbnails(container: HTMLElement, direction: string = SLIDE_DIRECTION.NEXT) {
    const parent = this.elementRef.nativeElement.querySelector('.' + DOM_CLASSES.THUMBNAILS);
    const containerWidth = container.offsetWidth;
    const children = container.querySelectorAll('li');
    const numElements = Math.ceil(containerWidth / this.options.get('thumbnailWidth'));
    const mask = parent.querySelector('.' + DOM_CLASSES.GRADIENT_MASK);
    const distance = (this.thumbnailOffset + 1) * numElements * this.options.get('thumbnailWidth') - this.options.get('thumbnailWidth');
    const curLeft = parseInt(container.getAttribute('data-left'), 10);
    const newLeft = direction === SLIDE_DIRECTION.NEXT ? (curLeft - distance) + 'px' : (curLeft + distance) + 'px';
    const page = parseInt(container.getAttribute('data-page'), 10);
    const newPage = direction === SLIDE_DIRECTION.NEXT ? page + 1 : page - 1;
    const totalPages = Math.round(children.length / numElements);

    if (newPage > totalPages) {
      parent.classList.add(DOM_CLASSES.NO_SCROLL_RIGHT);
      parent.classList.remove(DOM_CLASSES.NO_SCROLL_LEFT);
      mask.classList.remove(DOM_CLASSES.GRADIENT_MASK_BOTH, DOM_CLASSES.GRADIENT_MASK_RIGHT);
      mask.classList.add(DOM_CLASSES.GRADIENT_MASK_LEFT);
    } else if (newPage === 1) {
      parent.classList.add(DOM_CLASSES.NO_SCROLL_LEFT);
      mask.classList.remove(DOM_CLASSES.GRADIENT_MASK_BOTH, DOM_CLASSES.GRADIENT_MASK_LEFT);
      mask.classList.add(DOM_CLASSES.GRADIENT_MASK_RIGHT);
    } else {
      parent.classList.remove(DOM_CLASSES.NO_SCROLL_RIGHT, DOM_CLASSES.NO_SCROLL_LEFT);
      mask.classList.remove(DOM_CLASSES.GRADIENT_MASK_RIGHT, DOM_CLASSES.GRADIENT_MASK_LEFT);
      mask.classList.add(DOM_CLASSES.GRADIENT_MASK_BOTH);
    }

    container.style.left = newLeft;
    container.setAttribute('data-left', newLeft);
    container.setAttribute('data-page', newPage + '');
  }

  /**
   * Slides thumbnails to right
   *
   * @param container
   * @returns {void}
   */
  moveThumbnailsRight(container: HTMLElement): void {
    this.zone.runOutsideAngular(() => this.slideThumbnails(container, SLIDE_DIRECTION.NEXT));
    this.eventDispatcher.emit({label: EVENT.MOVE_THUMBNAILS_RIGHT});
  }

  /**
   * Slides thumbnails to left
   *
   * @param container
   * @returns {void}
   */
  moveThumbnailsLeft(container: HTMLElement) {
    this.zone.runOutsideAngular(() => this.slideThumbnails(container, SLIDE_DIRECTION.PREVIOUS));
    this.eventDispatcher.emit({label: EVENT.MOVE_THUMBNAILS_LEFT});
  }

  /**
   * Gets a protected safe url to use
   *
   * @param imageUrl
   * @returns {SafeStyle}
   */
  getSafeUrl(imageUrl: string): SafeUrl {
    return this.domSanitizer.bypassSecurityTrustStyle(`url(${imageUrl})`);
  }
}
