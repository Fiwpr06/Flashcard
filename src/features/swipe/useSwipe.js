const useSwipe = (() => {
  class SwipeHandler {
    constructor(container, card, options = {}) {
      this.container = container;
      this.card = card;
      this.options = {
        threshold:
          options.threshold ?? window.appConfig.swipe.horizontalThreshold,
        verticalThreshold:
          options.verticalThreshold ?? window.appConfig.swipe.verticalThreshold,
        maxRotation: options.maxRotation ?? 12,
        onDrag: options.onDrag ?? (() => {}),
        onSwipe: options.onSwipe ?? (() => {}),
        onReset: options.onReset ?? (() => {}),
        onTap: options.onTap ?? (() => {}),
      };

      this.dragging = false;
      this.startX = 0;
      this.startY = 0;
      this.deltaX = 0;
      this.deltaY = 0;
      this.hasMoved = false;
      this.activePointer = null;
      this.frameRequested = false;

      this.handleMouseDown = this.handleMouseDown.bind(this);
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);
      this.handleTouchStart = this.handleTouchStart.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
      this.handleTouchEnd = this.handleTouchEnd.bind(this);

      this.attach();
    }

    attach() {
      this.container.addEventListener("mousedown", this.handleMouseDown);
      this.container.addEventListener("touchstart", this.handleTouchStart, {
        passive: true,
      });
      this.container.addEventListener("touchmove", this.handleTouchMove, {
        passive: false,
      });
      this.container.addEventListener("touchend", this.handleTouchEnd);
      this.container.addEventListener("touchcancel", this.handleTouchEnd);
    }

    destroy() {
      this.container.removeEventListener("mousedown", this.handleMouseDown);
      this.container.removeEventListener("touchstart", this.handleTouchStart);
      this.container.removeEventListener("touchmove", this.handleTouchMove);
      this.container.removeEventListener("touchend", this.handleTouchEnd);
      this.container.removeEventListener("touchcancel", this.handleTouchEnd);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("mouseup", this.handleMouseUp);
    }

    handleMouseDown(event) {
      if (event.button !== 0) return;
      this.startDrag(event.clientX, event.clientY, "mouse");
      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("mouseup", this.handleMouseUp);
    }

    handleMouseMove(event) {
      if (!this.dragging || this.activePointer !== "mouse") return;
      this.onMove(event.clientX, event.clientY);
    }

    handleMouseUp() {
      if (this.activePointer !== "mouse") return;
      this.endDrag();
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("mouseup", this.handleMouseUp);
    }

    handleTouchStart(event) {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      this.startDrag(touch.clientX, touch.clientY, "touch");
    }

    handleTouchMove(event) {
      if (
        !this.dragging ||
        this.activePointer !== "touch" ||
        event.touches.length !== 1
      )
        return;
      const touch = event.touches[0];
      this.onMove(touch.clientX, touch.clientY);

      const horizontalDominant = Math.abs(this.deltaX) > Math.abs(this.deltaY);
      const upwardDominant =
        Math.abs(this.deltaY) > Math.abs(this.deltaX) && this.deltaY < 0;
      if (horizontalDominant || upwardDominant) {
        event.preventDefault();
      }
    }

    handleTouchEnd() {
      if (this.activePointer !== "touch") return;
      this.endDrag();
    }

    startDrag(x, y, pointerType) {
      this.dragging = true;
      this.hasMoved = false;
      this.startX = x;
      this.startY = y;
      this.deltaX = 0;
      this.deltaY = 0;
      this.activePointer = pointerType;
      this.card.style.transition = "none";
    }

    onMove(x, y) {
      this.deltaX = x - this.startX;
      this.deltaY = y - this.startY;
      if (Math.abs(this.deltaX) > 2 || Math.abs(this.deltaY) > 2) {
        this.hasMoved = true;
      }

      if (this.frameRequested) return;
      this.frameRequested = true;
      window.requestAnimationFrame(() => {
        this.frameRequested = false;
        const rotation = helpers.clamp(
          this.deltaX / 15,
          -this.options.maxRotation,
          this.options.maxRotation,
        );
        const translateY = Math.min(0, this.deltaY * 0.35);
        const opacity = Math.max(
          0.6,
          1 - Math.max(Math.abs(this.deltaX), Math.abs(this.deltaY)) / 450,
        );
        this.card.style.transform = `translate(${this.deltaX}px, ${translateY}px) rotate(${rotation}deg)`;
        this.card.style.opacity = `${opacity}`;

        const ratioX = Math.min(
          1,
          Math.abs(this.deltaX) / this.options.threshold,
        );
        const ratioY = Math.min(
          1,
          Math.abs(this.deltaY) / this.options.verticalThreshold,
        );
        const direction =
          this.deltaY < 0 && Math.abs(this.deltaY) > Math.abs(this.deltaX)
            ? "up"
            : this.deltaX > 0
              ? "right"
              : "left";

        this.options.onDrag({
          deltaX: this.deltaX,
          deltaY: this.deltaY,
          ratioX,
          ratioY,
          ratio: direction === "up" ? ratioY : ratioX,
          direction,
        });
      });
    }

    endDrag() {
      if (!this.dragging) return;
      this.dragging = false;

      const verticalSwipe =
        this.deltaY < 0 &&
        Math.abs(this.deltaY) >= this.options.verticalThreshold &&
        Math.abs(this.deltaY) > Math.abs(this.deltaX);
      const horizontalSwipe = Math.abs(this.deltaX) >= this.options.threshold;

      if (verticalSwipe) {
        this.card.style.transition = "transform 200ms ease, opacity 200ms ease";
        this.card.style.transform = `translateY(-${Math.max(120, this.options.verticalThreshold)}px)`;
        this.card.style.opacity = "0.85";
        window.setTimeout(() => this.options.onSwipe("up"), 190);
      } else if (horizontalSwipe) {
        const direction = this.deltaX > 0 ? "right" : "left";
        const targetX = (this.deltaX > 0 ? 1 : -1) * window.innerWidth;
        const targetRotation = (this.deltaX > 0 ? 1 : -1) * 20;
        this.card.style.transition = "transform 220ms ease, opacity 220ms ease";
        this.card.style.transform = `translateX(${targetX}px) rotate(${targetRotation}deg)`;
        this.card.style.opacity = "0";
        window.setTimeout(() => this.options.onSwipe(direction), 220);
      } else {
        if (!this.hasMoved) {
          this.card.style.transition = "";
          this.card.style.transform = "";
          this.card.style.opacity = "";
          this.options.onReset();
          this.options.onTap();
        } else {
          this.reset();
        }
      }

      this.activePointer = null;
    }

    reset() {
      this.card.style.transition = "transform 200ms ease, opacity 200ms ease";
      this.card.style.transform = "translateX(0) rotate(0deg)";
      this.card.style.opacity = "1";
      window.setTimeout(() => {
        this.card.style.transition = "";
        this.card.style.transform = "";
        this.card.style.opacity = "";
        this.options.onReset();
      }, 200);
    }
  }

  function create(container, card, options) {
    return new SwipeHandler(container, card, options);
  }

  return { create };
})();

window.useSwipe = useSwipe;
