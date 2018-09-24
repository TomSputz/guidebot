/* MISCELANEOUS NON-CRITICAL FUNCTIONS */

// EXTENDING NATIVE TYPES IS BAD PRACTICE. Why? Because if JavaScript adds this
// later, this conflicts with native code. Also, if some other lib you use does
// this, a conflict also occurs. KNOWING THIS however, the following 2 methods
// are, we feel, very useful in code. 

/**
   * {String}.toProperCase will return a string with every word capitalised
   * @constructor
   * @return {String} The proper case string ("Mary had a little lamb".toProperCase() returns "Mary Had A Little Lamb")
   */
Object.defineProperty(String.prototype, "toProperCase", {
  value: function() {
    return this.replace(/([^\W_]+[^\s-]*) */g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
});

// <Array>.random() returns a single random element from an array
// [1, 2, 3, 4, 5].random() can return 1, 2, 3, 4 or 5.
/**
   * {Array}.random will return a random element in an array
   * @constructor
   * @return {*} The chosen element ([1, 2, 3, 4, 5].random() can return 1, 2, 3, 4 or 5)
   */
Object.defineProperty(Array.prototype, "random", {
  value: function() {
    return this[Math.floor(Math.random() * this.length)];
  }
});