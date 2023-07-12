import iFrameResize from 'iframe-resizer/js/iframeResizer.js'

/**
 * Example component
 *
 * This allows automatic resizing of the iFrame pages contained within Example
 * template wrappers.
 *
 * @param {Element} $module - HTML element to use for example
 */
function Example ($module) {
  this.$module = $module
}

Example.prototype.init = function () {
  if (!this.$module) {
    return
  }
  this.$module.addEventListener('load', this.initIFrameResizer.bind(this))
}

Example.prototype.initIFrameResizer = function () {
  try {
    iFrameResize({ scrolling: 'omit' }, this.$module)
  } catch (err) {
    if (err) {
      console.error(err.message)
    }
  }
}

export default Example
