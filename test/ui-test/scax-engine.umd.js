(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ScaxEngine = {}));
})(this, (function (exports) { 'use strict';

    /**
     * 2D affine 왜곡 추정 전용 클래스입니다.
     * [x'; y'] = [[a b c], [d e f]] * [x y 1]^T 형태를 최소자승으로 적합합니다.
     */
    class Affine {
        constructor() {
            this.lastResult = null;
            this.lastPairs = [];
        }
        estimate(pairs) {
            const inputPairs = Array.isArray(pairs) ? pairs : [];
            this.lastPairs = inputPairs;
            const affine = this.fitAffine2D(inputPairs);
            if (!affine) {
                this.lastResult = null;
                return null;
            }
            let residualSumPct = 0;
            let residualCount = 0;
            let residualMaxPct = 0;
            const residuals = [];
            for (const pair of inputPairs) {
                const px = affine.a * pair.sx + affine.b * pair.sy + affine.c;
                const py = affine.d * pair.sx + affine.e * pair.sy + affine.f;
                const rx = pair.tx - px;
                const ry = pair.ty - py;
                const magnitude = Math.hypot(rx, ry);
                if (magnitude < 1e-4)
                    continue;
                const radiusRef = Math.hypot(px, py);
                const pct = (magnitude / Math.max(0.2, radiusRef)) * 100;
                residualSumPct += pct;
                residualCount += 1;
                residualMaxPct = Math.max(residualMaxPct, pct);
                residuals.push({ sx: pair.sx, sy: pair.sy, px, py, rx, ry, magnitude, pct });
            }
            const result = {
                ...affine,
                count: inputPairs.length,
                residualAvgPct: residualCount ? residualSumPct / residualCount : 0,
                residualMaxPct,
                residuals,
            };
            this.lastResult = result;
            return result;
        }
        /**
         * 마지막 affine 추정 결과를 반환합니다.
         */
        getLastResult() {
            return this.lastResult;
        }
        /**
         * 마지막 affine 추정에 사용된 입력쌍을 반환합니다.
         */
        getLastPairs() {
            return [...this.lastPairs];
        }
        fitAffine2D(pairs) {
            if (!Array.isArray(pairs) || pairs.length < 4)
                return null;
            const ata = Array.from({ length: 6 }, () => Array(6).fill(0));
            const atb = Array(6).fill(0);
            const accumulate = (row, rhs) => {
                for (let i = 0; i < 6; i += 1) {
                    atb[i] += row[i] * rhs;
                    for (let j = 0; j < 6; j += 1)
                        ata[i][j] += row[i] * row[j];
                }
            };
            for (const pair of pairs) {
                accumulate([pair.sx, pair.sy, 1, 0, 0, 0], pair.tx);
                accumulate([0, 0, 0, pair.sx, pair.sy, 1], pair.ty);
            }
            const n = 6;
            const aug = ata.map((row, index) => [...row, atb[index]]);
            for (let col = 0; col < n; col += 1) {
                let pivot = col;
                for (let row = col + 1; row < n; row += 1) {
                    if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col]))
                        pivot = row;
                }
                if (Math.abs(aug[pivot][col]) < 1e-10)
                    return null;
                if (pivot !== col) {
                    const temp = aug[col];
                    aug[col] = aug[pivot];
                    aug[pivot] = temp;
                }
                const divider = aug[col][col];
                for (let j = col; j <= n; j += 1)
                    aug[col][j] /= divider;
                for (let row = 0; row < n; row += 1) {
                    if (row === col)
                        continue;
                    const factor = aug[row][col];
                    if (Math.abs(factor) < 1e-12)
                        continue;
                    for (let j = col; j <= n; j += 1)
                        aug[row][j] -= factor * aug[col][j];
                }
            }
            return {
                a: aug[0][n],
                b: aug[1][n],
                c: aug[2][n],
                d: aug[3][n],
                e: aug[4][n],
                f: aug[5][n],
            };
        }
    }

    /**
     * @license
     * Copyright 2010-2026 Three.js Authors
     * SPDX-License-Identifier: MIT
     */
    const REVISION = '184';

    /**
     * WebGL coordinate system.
     *
     * @type {number}
     * @constant
     */
    const WebGLCoordinateSystem = 2000;

    /**
     * WebGPU coordinate system.
     *
     * @type {number}
     * @constant
     */
    const WebGPUCoordinateSystem = 2001;

    /**
     * Enhances log/warn/error messages related to TSL.
     *
     * @param {Array<any>} params - The original message parameters.
     * @returns {Array<any>} The filtered and enhanced message parameters.
     */
    function enhanceLogMessage( params ) {

    	const message = params[ 0 ];

    	if ( typeof message === 'string' && message.startsWith( 'TSL:' ) ) {

    		const stackTrace = params[ 1 ];

    		if ( stackTrace && stackTrace.isStackTrace ) {

    			params[ 0 ] += ' ' + stackTrace.getLocation();

    		} else {

    			params[ 1 ] = 'Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.';

    		}

    	}

    	return params;

    }

    /**
     * Logs a warning message with the 'THREE.' prefix.
     *
     * If a custom console function is set via setConsoleFunction(), it will be used
     * instead of the native console.warn. The first parameter is treated as the
     * method name and is automatically prefixed with 'THREE.'.
     *
     * @param {...any} params - The message components. The first param is used as
     *                          the method name and prefixed with 'THREE.'.
     */
    function warn( ...params ) {

    	params = enhanceLogMessage( params );

    	const message = 'THREE.' + params.shift();

    	{

    		const stackTrace = params[ 0 ];

    		if ( stackTrace && stackTrace.isStackTrace ) {

    			console.warn( stackTrace.getError( message ) );

    		} else {

    			console.warn( message, ...params );

    		}

    	}

    }

    /**
     * Clamps the given value between min and max.
     *
     * @param {number} value - The value to clamp.
     * @param {number} min - The min value.
     * @param {number} max - The max value.
     * @return {number} The clamped value.
     */
    function clamp( value, min, max ) {

    	return Math.max( min, Math.min( max, value ) );

    }

    /**
     * Class representing a 2D vector. A 2D vector is an ordered pair of numbers
     * (labeled x and y), which can be used to represent a number of things, such as:
     *
     * - A point in 2D space (i.e. a position on a plane).
     * - A direction and length across a plane. In three.js the length will
     * always be the Euclidean distance(straight-line distance) from `(0, 0)` to `(x, y)`
     * and the direction is also measured from `(0, 0)` towards `(x, y)`.
     * - Any arbitrary ordered pair of numbers.
     *
     * There are other things a 2D vector can be used to represent, such as
     * momentum vectors, complex numbers and so on, however these are the most
     * common uses in three.js.
     *
     * Iterating through a vector instance will yield its components `(x, y)` in
     * the corresponding order.
     * ```js
     * const a = new THREE.Vector2( 0, 1 );
     *
     * //no arguments; will be initialised to (0, 0)
     * const b = new THREE.Vector2( );
     *
     * const d = a.distanceTo( b );
     * ```
     */
    class Vector2 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Vector2.prototype.isVector2 = true;

    	}

    	/**
    	 * Constructs a new 2D vector.
    	 *
    	 * @param {number} [x=0] - The x value of this vector.
    	 * @param {number} [y=0] - The y value of this vector.
    	 */
    	constructor( x = 0, y = 0 ) {

    		/**
    		 * The x value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.x = x;

    		/**
    		 * The y value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.y = y;

    	}

    	/**
    	 * Alias for {@link Vector2#x}.
    	 *
    	 * @type {number}
    	 */
    	get width() {

    		return this.x;

    	}

    	set width( value ) {

    		this.x = value;

    	}

    	/**
    	 * Alias for {@link Vector2#y}.
    	 *
    	 * @type {number}
    	 */
    	get height() {

    		return this.y;

    	}

    	set height( value ) {

    		this.y = value;

    	}

    	/**
    	 * Sets the vector components.
    	 *
    	 * @param {number} x - The value of the x component.
    	 * @param {number} y - The value of the y component.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	set( x, y ) {

    		this.x = x;
    		this.y = y;

    		return this;

    	}

    	/**
    	 * Sets the vector components to the same value.
    	 *
    	 * @param {number} scalar - The value to set for all vector components.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	setScalar( scalar ) {

    		this.x = scalar;
    		this.y = scalar;

    		return this;

    	}

    	/**
    	 * Sets the vector's x component to the given value
    	 *
    	 * @param {number} x - The value to set.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	setX( x ) {

    		this.x = x;

    		return this;

    	}

    	/**
    	 * Sets the vector's y component to the given value
    	 *
    	 * @param {number} y - The value to set.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	setY( y ) {

    		this.y = y;

    		return this;

    	}

    	/**
    	 * Allows to set a vector component with an index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y.
    	 * @param {number} value - The value to set.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	setComponent( index, value ) {

    		switch ( index ) {

    			case 0: this.x = value; break;
    			case 1: this.y = value; break;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    		return this;

    	}

    	/**
    	 * Returns the value of the vector component which matches the given index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y.
    	 * @return {number} A vector component value.
    	 */
    	getComponent( index ) {

    		switch ( index ) {

    			case 0: return this.x;
    			case 1: return this.y;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    	}

    	/**
    	 * Returns a new vector with copied values from this instance.
    	 *
    	 * @return {Vector2} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor( this.x, this.y );

    	}

    	/**
    	 * Copies the values of the given vector to this instance.
    	 *
    	 * @param {Vector2} v - The vector to copy.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	copy( v ) {

    		this.x = v.x;
    		this.y = v.y;

    		return this;

    	}

    	/**
    	 * Adds the given vector to this instance.
    	 *
    	 * @param {Vector2} v - The vector to add.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	add( v ) {

    		this.x += v.x;
    		this.y += v.y;

    		return this;

    	}

    	/**
    	 * Adds the given scalar value to all components of this instance.
    	 *
    	 * @param {number} s - The scalar to add.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	addScalar( s ) {

    		this.x += s;
    		this.y += s;

    		return this;

    	}

    	/**
    	 * Adds the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector2} a - The first vector.
    	 * @param {Vector2} b - The second vector.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	addVectors( a, b ) {

    		this.x = a.x + b.x;
    		this.y = a.y + b.y;

    		return this;

    	}

    	/**
    	 * Adds the given vector scaled by the given factor to this instance.
    	 *
    	 * @param {Vector2} v - The vector.
    	 * @param {number} s - The factor that scales `v`.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	addScaledVector( v, s ) {

    		this.x += v.x * s;
    		this.y += v.y * s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vector from this instance.
    	 *
    	 * @param {Vector2} v - The vector to subtract.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	sub( v ) {

    		this.x -= v.x;
    		this.y -= v.y;

    		return this;

    	}

    	/**
    	 * Subtracts the given scalar value from all components of this instance.
    	 *
    	 * @param {number} s - The scalar to subtract.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	subScalar( s ) {

    		this.x -= s;
    		this.y -= s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector2} a - The first vector.
    	 * @param {Vector2} b - The second vector.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	subVectors( a, b ) {

    		this.x = a.x - b.x;
    		this.y = a.y - b.y;

    		return this;

    	}

    	/**
    	 * Multiplies the given vector with this instance.
    	 *
    	 * @param {Vector2} v - The vector to multiply.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	multiply( v ) {

    		this.x *= v.x;
    		this.y *= v.y;

    		return this;

    	}

    	/**
    	 * Multiplies the given scalar value with all components of this instance.
    	 *
    	 * @param {number} scalar - The scalar to multiply.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	multiplyScalar( scalar ) {

    		this.x *= scalar;
    		this.y *= scalar;

    		return this;

    	}

    	/**
    	 * Divides this instance by the given vector.
    	 *
    	 * @param {Vector2} v - The vector to divide.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	divide( v ) {

    		this.x /= v.x;
    		this.y /= v.y;

    		return this;

    	}

    	/**
    	 * Divides this vector by the given scalar.
    	 *
    	 * @param {number} scalar - The scalar to divide.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	divideScalar( scalar ) {

    		return this.multiplyScalar( 1 / scalar );

    	}

    	/**
    	 * Multiplies this vector (with an implicit 1 as the 3rd component) by
    	 * the given 3x3 matrix.
    	 *
    	 * @param {Matrix3} m - The matrix to apply.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	applyMatrix3( m ) {

    		const x = this.x, y = this.y;
    		const e = m.elements;

    		this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ];
    		this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ];

    		return this;

    	}

    	/**
    	 * If this vector's x or y value is greater than the given vector's x or y
    	 * value, replace that value with the corresponding min value.
    	 *
    	 * @param {Vector2} v - The vector.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	min( v ) {

    		this.x = Math.min( this.x, v.x );
    		this.y = Math.min( this.y, v.y );

    		return this;

    	}

    	/**
    	 * If this vector's x or y value is less than the given vector's x or y
    	 * value, replace that value with the corresponding max value.
    	 *
    	 * @param {Vector2} v - The vector.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	max( v ) {

    		this.x = Math.max( this.x, v.x );
    		this.y = Math.max( this.y, v.y );

    		return this;

    	}

    	/**
    	 * If this vector's x or y value is greater than the max vector's x or y
    	 * value, it is replaced by the corresponding value.
    	 * If this vector's x or y value is less than the min vector's x or y value,
    	 * it is replaced by the corresponding value.
    	 *
    	 * @param {Vector2} min - The minimum x and y values.
    	 * @param {Vector2} max - The maximum x and y values in the desired range.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	clamp( min, max ) {

    		// assumes min < max, componentwise

    		this.x = clamp( this.x, min.x, max.x );
    		this.y = clamp( this.y, min.y, max.y );

    		return this;

    	}

    	/**
    	 * If this vector's x or y values are greater than the max value, they are
    	 * replaced by the max value.
    	 * If this vector's x or y values are less than the min value, they are
    	 * replaced by the min value.
    	 *
    	 * @param {number} minVal - The minimum value the components will be clamped to.
    	 * @param {number} maxVal - The maximum value the components will be clamped to.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	clampScalar( minVal, maxVal ) {

    		this.x = clamp( this.x, minVal, maxVal );
    		this.y = clamp( this.y, minVal, maxVal );

    		return this;

    	}

    	/**
    	 * If this vector's length is greater than the max value, it is replaced by
    	 * the max value.
    	 * If this vector's length is less than the min value, it is replaced by the
    	 * min value.
    	 *
    	 * @param {number} min - The minimum value the vector length will be clamped to.
    	 * @param {number} max - The maximum value the vector length will be clamped to.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	clampLength( min, max ) {

    		const length = this.length();

    		return this.divideScalar( length || 1 ).multiplyScalar( clamp( length, min, max ) );

    	}

    	/**
    	 * The components of this vector are rounded down to the nearest integer value.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	floor() {

    		this.x = Math.floor( this.x );
    		this.y = Math.floor( this.y );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded up to the nearest integer value.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	ceil() {

    		this.x = Math.ceil( this.x );
    		this.y = Math.ceil( this.y );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded to the nearest integer value
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	round() {

    		this.x = Math.round( this.x );
    		this.y = Math.round( this.y );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded towards zero (up if negative,
    	 * down if positive) to an integer value.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	roundToZero() {

    		this.x = Math.trunc( this.x );
    		this.y = Math.trunc( this.y );

    		return this;

    	}

    	/**
    	 * Inverts this vector - i.e. sets x = -x and y = -y.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	negate() {

    		this.x = - this.x;
    		this.y = - this.y;

    		return this;

    	}

    	/**
    	 * Calculates the dot product of the given vector with this instance.
    	 *
    	 * @param {Vector2} v - The vector to compute the dot product with.
    	 * @return {number} The result of the dot product.
    	 */
    	dot( v ) {

    		return this.x * v.x + this.y * v.y;

    	}

    	/**
    	 * Calculates the cross product of the given vector with this instance.
    	 *
    	 * @param {Vector2} v - The vector to compute the cross product with.
    	 * @return {number} The result of the cross product.
    	 */
    	cross( v ) {

    		return this.x * v.y - this.y * v.x;

    	}

    	/**
    	 * Computes the square of the Euclidean length (straight-line length) from
    	 * (0, 0) to (x, y). If you are comparing the lengths of vectors, you should
    	 * compare the length squared instead as it is slightly more efficient to calculate.
    	 *
    	 * @return {number} The square length of this vector.
    	 */
    	lengthSq() {

    		return this.x * this.x + this.y * this.y;

    	}

    	/**
    	 * Computes the  Euclidean length (straight-line length) from (0, 0) to (x, y).
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	length() {

    		return Math.sqrt( this.x * this.x + this.y * this.y );

    	}

    	/**
    	 * Computes the Manhattan length of this vector.
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	manhattanLength() {

    		return Math.abs( this.x ) + Math.abs( this.y );

    	}

    	/**
    	 * Converts this vector to a unit vector - that is, sets it equal to a vector
    	 * with the same direction as this one, but with a vector length of `1`.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	normalize() {

    		return this.divideScalar( this.length() || 1 );

    	}

    	/**
    	 * Computes the angle in radians of this vector with respect to the positive x-axis.
    	 *
    	 * @return {number} The angle in radians.
    	 */
    	angle() {

    		const angle = Math.atan2( - this.y, - this.x ) + Math.PI;

    		return angle;

    	}

    	/**
    	 * Returns the angle between the given vector and this instance in radians.
    	 *
    	 * @param {Vector2} v - The vector to compute the angle with.
    	 * @return {number} The angle in radians.
    	 */
    	angleTo( v ) {

    		const denominator = Math.sqrt( this.lengthSq() * v.lengthSq() );

    		if ( denominator === 0 ) return Math.PI / 2;

    		const theta = this.dot( v ) / denominator;

    		// clamp, to handle numerical problems

    		return Math.acos( clamp( theta, -1, 1 ) );

    	}

    	/**
    	 * Computes the distance from the given vector to this instance.
    	 *
    	 * @param {Vector2} v - The vector to compute the distance to.
    	 * @return {number} The distance.
    	 */
    	distanceTo( v ) {

    		return Math.sqrt( this.distanceToSquared( v ) );

    	}

    	/**
    	 * Computes the squared distance from the given vector to this instance.
    	 * If you are just comparing the distance with another distance, you should compare
    	 * the distance squared instead as it is slightly more efficient to calculate.
    	 *
    	 * @param {Vector2} v - The vector to compute the squared distance to.
    	 * @return {number} The squared distance.
    	 */
    	distanceToSquared( v ) {

    		const dx = this.x - v.x, dy = this.y - v.y;
    		return dx * dx + dy * dy;

    	}

    	/**
    	 * Computes the Manhattan distance from the given vector to this instance.
    	 *
    	 * @param {Vector2} v - The vector to compute the Manhattan distance to.
    	 * @return {number} The Manhattan distance.
    	 */
    	manhattanDistanceTo( v ) {

    		return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y );

    	}

    	/**
    	 * Sets this vector to a vector with the same direction as this one, but
    	 * with the specified length.
    	 *
    	 * @param {number} length - The new length of this vector.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	setLength( length ) {

    		return this.normalize().multiplyScalar( length );

    	}

    	/**
    	 * Linearly interpolates between the given vector and this instance, where
    	 * alpha is the percent distance along the line - alpha = 0 will be this
    	 * vector, and alpha = 1 will be the given one.
    	 *
    	 * @param {Vector2} v - The vector to interpolate towards.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	lerp( v, alpha ) {

    		this.x += ( v.x - this.x ) * alpha;
    		this.y += ( v.y - this.y ) * alpha;

    		return this;

    	}

    	/**
    	 * Linearly interpolates between the given vectors, where alpha is the percent
    	 * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
    	 * be the second one. The result is stored in this instance.
    	 *
    	 * @param {Vector2} v1 - The first vector.
    	 * @param {Vector2} v2 - The second vector.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	lerpVectors( v1, v2, alpha ) {

    		this.x = v1.x + ( v2.x - v1.x ) * alpha;
    		this.y = v1.y + ( v2.y - v1.y ) * alpha;

    		return this;

    	}

    	/**
    	 * Returns `true` if this vector is equal with the given one.
    	 *
    	 * @param {Vector2} v - The vector to test for equality.
    	 * @return {boolean} Whether this vector is equal with the given one.
    	 */
    	equals( v ) {

    		return ( ( v.x === this.x ) && ( v.y === this.y ) );

    	}

    	/**
    	 * Sets this vector's x value to be `array[ offset ]` and y
    	 * value to be `array[ offset + 1 ]`.
    	 *
    	 * @param {Array<number>} array - An array holding the vector component values.
    	 * @param {number} [offset=0] - The offset into the array.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	fromArray( array, offset = 0 ) {

    		this.x = array[ offset ];
    		this.y = array[ offset + 1 ];

    		return this;

    	}

    	/**
    	 * Writes the components of this vector to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the vector components.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The vector components.
    	 */
    	toArray( array = [], offset = 0 ) {

    		array[ offset ] = this.x;
    		array[ offset + 1 ] = this.y;

    		return array;

    	}

    	/**
    	 * Sets the components of this vector from the given buffer attribute.
    	 *
    	 * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
    	 * @param {number} index - The index into the attribute.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	fromBufferAttribute( attribute, index ) {

    		this.x = attribute.getX( index );
    		this.y = attribute.getY( index );

    		return this;

    	}

    	/**
    	 * Rotates this vector around the given center by the given angle.
    	 *
    	 * @param {Vector2} center - The point around which to rotate.
    	 * @param {number} angle - The angle to rotate, in radians.
    	 * @return {Vector2} A reference to this vector.
    	 */
    	rotateAround( center, angle ) {

    		const c = Math.cos( angle ), s = Math.sin( angle );

    		const x = this.x - center.x;
    		const y = this.y - center.y;

    		this.x = x * c - y * s + center.x;
    		this.y = x * s + y * c + center.y;

    		return this;

    	}

    	/**
    	 * Sets each component of this vector to a pseudo-random value between `0` and
    	 * `1`, excluding `1`.
    	 *
    	 * @return {Vector2} A reference to this vector.
    	 */
    	random() {

    		this.x = Math.random();
    		this.y = Math.random();

    		return this;

    	}

    	*[ Symbol.iterator ]() {

    		yield this.x;
    		yield this.y;

    	}

    }

    /**
     * Class for representing a Quaternion. Quaternions are used in three.js to represent rotations.
     *
     * Iterating through a vector instance will yield its components `(x, y, z, w)` in
     * the corresponding order.
     *
     * Note that three.js expects Quaternions to be normalized.
     * ```js
     * const quaternion = new THREE.Quaternion();
     * quaternion.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), Math.PI / 2 );
     *
     * const vector = new THREE.Vector3( 1, 0, 0 );
     * vector.applyQuaternion( quaternion );
     * ```
     */
    class Quaternion {

    	/**
    	 * Constructs a new quaternion.
    	 *
    	 * @param {number} [x=0] - The x value of this quaternion.
    	 * @param {number} [y=0] - The y value of this quaternion.
    	 * @param {number} [z=0] - The z value of this quaternion.
    	 * @param {number} [w=1] - The w value of this quaternion.
    	 */
    	constructor( x = 0, y = 0, z = 0, w = 1 ) {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		this.isQuaternion = true;

    		this._x = x;
    		this._y = y;
    		this._z = z;
    		this._w = w;

    	}

    	/**
    	 * Interpolates between two quaternions via SLERP. This implementation assumes the
    	 * quaternion data are managed in flat arrays.
    	 *
    	 * @param {Array<number>} dst - The destination array.
    	 * @param {number} dstOffset - An offset into the destination array.
    	 * @param {Array<number>} src0 - The source array of the first quaternion.
    	 * @param {number} srcOffset0 - An offset into the first source array.
    	 * @param {Array<number>} src1 -  The source array of the second quaternion.
    	 * @param {number} srcOffset1 - An offset into the second source array.
    	 * @param {number} t - The interpolation factor. A value in the range `[0,1]` will interpolate. A value outside the range `[0,1]` will extrapolate.
    	 * @see {@link Quaternion#slerp}
    	 */
    	static slerpFlat( dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t ) {

    		let x0 = src0[ srcOffset0 + 0 ],
    			y0 = src0[ srcOffset0 + 1 ],
    			z0 = src0[ srcOffset0 + 2 ],
    			w0 = src0[ srcOffset0 + 3 ];

    		let x1 = src1[ srcOffset1 + 0 ],
    			y1 = src1[ srcOffset1 + 1 ],
    			z1 = src1[ srcOffset1 + 2 ],
    			w1 = src1[ srcOffset1 + 3 ];

    		if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

    			let dot = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;

    			if ( dot < 0 ) {

    				x1 = - x1;
    				y1 = - y1;
    				z1 = - z1;
    				w1 = - w1;

    				dot = - dot;

    			}

    			let s = 1 - t;

    			if ( dot < 0.9995 ) {

    				// slerp

    				const theta = Math.acos( dot );
    				const sin = Math.sin( theta );

    				s = Math.sin( s * theta ) / sin;
    				t = Math.sin( t * theta ) / sin;

    				x0 = x0 * s + x1 * t;
    				y0 = y0 * s + y1 * t;
    				z0 = z0 * s + z1 * t;
    				w0 = w0 * s + w1 * t;

    			} else {

    				// for small angles, lerp then normalize

    				x0 = x0 * s + x1 * t;
    				y0 = y0 * s + y1 * t;
    				z0 = z0 * s + z1 * t;
    				w0 = w0 * s + w1 * t;

    				const f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );

    				x0 *= f;
    				y0 *= f;
    				z0 *= f;
    				w0 *= f;

    			}

    		}

    		dst[ dstOffset ] = x0;
    		dst[ dstOffset + 1 ] = y0;
    		dst[ dstOffset + 2 ] = z0;
    		dst[ dstOffset + 3 ] = w0;

    	}

    	/**
    	 * Multiplies two quaternions. This implementation assumes the quaternion data are managed
    	 * in flat arrays.
    	 *
    	 * @param {Array<number>} dst - The destination array.
    	 * @param {number} dstOffset - An offset into the destination array.
    	 * @param {Array<number>} src0 - The source array of the first quaternion.
    	 * @param {number} srcOffset0 - An offset into the first source array.
    	 * @param {Array<number>} src1 -  The source array of the second quaternion.
    	 * @param {number} srcOffset1 - An offset into the second source array.
    	 * @return {Array<number>} The destination array.
    	 * @see {@link Quaternion#multiplyQuaternions}.
    	 */
    	static multiplyQuaternionsFlat( dst, dstOffset, src0, srcOffset0, src1, srcOffset1 ) {

    		const x0 = src0[ srcOffset0 ];
    		const y0 = src0[ srcOffset0 + 1 ];
    		const z0 = src0[ srcOffset0 + 2 ];
    		const w0 = src0[ srcOffset0 + 3 ];

    		const x1 = src1[ srcOffset1 ];
    		const y1 = src1[ srcOffset1 + 1 ];
    		const z1 = src1[ srcOffset1 + 2 ];
    		const w1 = src1[ srcOffset1 + 3 ];

    		dst[ dstOffset ] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    		dst[ dstOffset + 1 ] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    		dst[ dstOffset + 2 ] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    		dst[ dstOffset + 3 ] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;

    		return dst;

    	}

    	/**
    	 * The x value of this quaternion.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get x() {

    		return this._x;

    	}

    	set x( value ) {

    		this._x = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * The y value of this quaternion.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get y() {

    		return this._y;

    	}

    	set y( value ) {

    		this._y = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * The z value of this quaternion.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get z() {

    		return this._z;

    	}

    	set z( value ) {

    		this._z = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * The w value of this quaternion.
    	 *
    	 * @type {number}
    	 * @default 1
    	 */
    	get w() {

    		return this._w;

    	}

    	set w( value ) {

    		this._w = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * Sets the quaternion components.
    	 *
    	 * @param {number} x - The x value of this quaternion.
    	 * @param {number} y - The y value of this quaternion.
    	 * @param {number} z - The z value of this quaternion.
    	 * @param {number} w - The w value of this quaternion.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	set( x, y, z, w ) {

    		this._x = x;
    		this._y = y;
    		this._z = z;
    		this._w = w;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Returns a new quaternion with copied values from this instance.
    	 *
    	 * @return {Quaternion} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor( this._x, this._y, this._z, this._w );

    	}

    	/**
    	 * Copies the values of the given quaternion to this instance.
    	 *
    	 * @param {Quaternion} quaternion - The quaternion to copy.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	copy( quaternion ) {

    		this._x = quaternion.x;
    		this._y = quaternion.y;
    		this._z = quaternion.z;
    		this._w = quaternion.w;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets this quaternion from the rotation specified by the given
    	 * Euler angles.
    	 *
    	 * @param {Euler} euler - The Euler angles.
    	 * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	setFromEuler( euler, update = true ) {

    		const x = euler._x, y = euler._y, z = euler._z, order = euler._order;

    		// http://www.mathworks.com/matlabcentral/fileexchange/
    		// 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
    		//	content/SpinCalc.m

    		const cos = Math.cos;
    		const sin = Math.sin;

    		const c1 = cos( x / 2 );
    		const c2 = cos( y / 2 );
    		const c3 = cos( z / 2 );

    		const s1 = sin( x / 2 );
    		const s2 = sin( y / 2 );
    		const s3 = sin( z / 2 );

    		switch ( order ) {

    			case 'XYZ':
    				this._x = s1 * c2 * c3 + c1 * s2 * s3;
    				this._y = c1 * s2 * c3 - s1 * c2 * s3;
    				this._z = c1 * c2 * s3 + s1 * s2 * c3;
    				this._w = c1 * c2 * c3 - s1 * s2 * s3;
    				break;

    			case 'YXZ':
    				this._x = s1 * c2 * c3 + c1 * s2 * s3;
    				this._y = c1 * s2 * c3 - s1 * c2 * s3;
    				this._z = c1 * c2 * s3 - s1 * s2 * c3;
    				this._w = c1 * c2 * c3 + s1 * s2 * s3;
    				break;

    			case 'ZXY':
    				this._x = s1 * c2 * c3 - c1 * s2 * s3;
    				this._y = c1 * s2 * c3 + s1 * c2 * s3;
    				this._z = c1 * c2 * s3 + s1 * s2 * c3;
    				this._w = c1 * c2 * c3 - s1 * s2 * s3;
    				break;

    			case 'ZYX':
    				this._x = s1 * c2 * c3 - c1 * s2 * s3;
    				this._y = c1 * s2 * c3 + s1 * c2 * s3;
    				this._z = c1 * c2 * s3 - s1 * s2 * c3;
    				this._w = c1 * c2 * c3 + s1 * s2 * s3;
    				break;

    			case 'YZX':
    				this._x = s1 * c2 * c3 + c1 * s2 * s3;
    				this._y = c1 * s2 * c3 + s1 * c2 * s3;
    				this._z = c1 * c2 * s3 - s1 * s2 * c3;
    				this._w = c1 * c2 * c3 - s1 * s2 * s3;
    				break;

    			case 'XZY':
    				this._x = s1 * c2 * c3 - c1 * s2 * s3;
    				this._y = c1 * s2 * c3 - s1 * c2 * s3;
    				this._z = c1 * c2 * s3 + s1 * s2 * c3;
    				this._w = c1 * c2 * c3 + s1 * s2 * s3;
    				break;

    			default:
    				warn( 'Quaternion: .setFromEuler() encountered an unknown order: ' + order );

    		}

    		if ( update === true ) this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets this quaternion from the given axis and angle.
    	 *
    	 * @param {Vector3} axis - The normalized axis.
    	 * @param {number} angle - The angle in radians.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	setFromAxisAngle( axis, angle ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

    		const halfAngle = angle / 2, s = Math.sin( halfAngle );

    		this._x = axis.x * s;
    		this._y = axis.y * s;
    		this._z = axis.z * s;
    		this._w = Math.cos( halfAngle );

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets this quaternion from the given rotation matrix.
    	 *
    	 * @param {Matrix4} m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	setFromRotationMatrix( m ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

    		// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    		const te = m.elements,

    			m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ],
    			m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ],
    			m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ],

    			trace = m11 + m22 + m33;

    		if ( trace > 0 ) {

    			const s = 0.5 / Math.sqrt( trace + 1.0 );

    			this._w = 0.25 / s;
    			this._x = ( m32 - m23 ) * s;
    			this._y = ( m13 - m31 ) * s;
    			this._z = ( m21 - m12 ) * s;

    		} else if ( m11 > m22 && m11 > m33 ) {

    			const s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );

    			this._w = ( m32 - m23 ) / s;
    			this._x = 0.25 * s;
    			this._y = ( m12 + m21 ) / s;
    			this._z = ( m13 + m31 ) / s;

    		} else if ( m22 > m33 ) {

    			const s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );

    			this._w = ( m13 - m31 ) / s;
    			this._x = ( m12 + m21 ) / s;
    			this._y = 0.25 * s;
    			this._z = ( m23 + m32 ) / s;

    		} else {

    			const s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );

    			this._w = ( m21 - m12 ) / s;
    			this._x = ( m13 + m31 ) / s;
    			this._y = ( m23 + m32 ) / s;
    			this._z = 0.25 * s;

    		}

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets this quaternion to the rotation required to rotate the direction vector
    	 * `vFrom` to the direction vector `vTo`.
    	 *
    	 * @param {Vector3} vFrom - The first (normalized) direction vector.
    	 * @param {Vector3} vTo - The second (normalized) direction vector.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	setFromUnitVectors( vFrom, vTo ) {

    		// assumes direction vectors vFrom and vTo are normalized

    		let r = vFrom.dot( vTo ) + 1;

    		if ( r < 1e-8 ) { // the epsilon value has been discussed in #31286

    			// vFrom and vTo point in opposite directions

    			r = 0;

    			if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {

    				this._x = - vFrom.y;
    				this._y = vFrom.x;
    				this._z = 0;
    				this._w = r;

    			} else {

    				this._x = 0;
    				this._y = - vFrom.z;
    				this._z = vFrom.y;
    				this._w = r;

    			}

    		} else {

    			// crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

    			this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
    			this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
    			this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
    			this._w = r;

    		}

    		return this.normalize();

    	}

    	/**
    	 * Returns the angle between this quaternion and the given one in radians.
    	 *
    	 * @param {Quaternion} q - The quaternion to compute the angle with.
    	 * @return {number} The angle in radians.
    	 */
    	angleTo( q ) {

    		return 2 * Math.acos( Math.abs( clamp( this.dot( q ), -1, 1 ) ) );

    	}

    	/**
    	 * Rotates this quaternion by a given angular step to the given quaternion.
    	 * The method ensures that the final quaternion will not overshoot `q`.
    	 *
    	 * @param {Quaternion} q - The target quaternion.
    	 * @param {number} step - The angular step in radians.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	rotateTowards( q, step ) {

    		const angle = this.angleTo( q );

    		if ( angle === 0 ) return this;

    		const t = Math.min( 1, step / angle );

    		this.slerp( q, t );

    		return this;

    	}

    	/**
    	 * Sets this quaternion to the identity quaternion; that is, to the
    	 * quaternion that represents "no rotation".
    	 *
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	identity() {

    		return this.set( 0, 0, 0, 1 );

    	}

    	/**
    	 * Inverts this quaternion via {@link Quaternion#conjugate}. The
    	 * quaternion is assumed to have unit length.
    	 *
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	invert() {

    		return this.conjugate();

    	}

    	/**
    	 * Returns the rotational conjugate of this quaternion. The conjugate of a
    	 * quaternion represents the same rotation in the opposite direction about
    	 * the rotational axis.
    	 *
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	conjugate() {

    		this._x *= -1;
    		this._y *= -1;
    		this._z *= -1;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Calculates the dot product of this quaternion and the given one.
    	 *
    	 * @param {Quaternion} v - The quaternion to compute the dot product with.
    	 * @return {number} The result of the dot product.
    	 */
    	dot( v ) {

    		return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;

    	}

    	/**
    	 * Computes the squared Euclidean length (straight-line length) of this quaternion,
    	 * considered as a 4 dimensional vector. This can be useful if you are comparing the
    	 * lengths of two quaternions, as this is a slightly more efficient calculation than
    	 * {@link Quaternion#length}.
    	 *
    	 * @return {number} The squared Euclidean length.
    	 */
    	lengthSq() {

    		return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;

    	}

    	/**
    	 * Computes the Euclidean length (straight-line length) of this quaternion,
    	 * considered as a 4 dimensional vector.
    	 *
    	 * @return {number} The Euclidean length.
    	 */
    	length() {

    		return Math.sqrt( this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w );

    	}

    	/**
    	 * Normalizes this quaternion - that is, calculated the quaternion that performs
    	 * the same rotation as this one, but has a length equal to `1`.
    	 *
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	normalize() {

    		let l = this.length();

    		if ( l === 0 ) {

    			this._x = 0;
    			this._y = 0;
    			this._z = 0;
    			this._w = 1;

    		} else {

    			l = 1 / l;

    			this._x = this._x * l;
    			this._y = this._y * l;
    			this._z = this._z * l;
    			this._w = this._w * l;

    		}

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Multiplies this quaternion by the given one.
    	 *
    	 * @param {Quaternion} q - The quaternion.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	multiply( q ) {

    		return this.multiplyQuaternions( this, q );

    	}

    	/**
    	 * Pre-multiplies this quaternion by the given one.
    	 *
    	 * @param {Quaternion} q - The quaternion.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	premultiply( q ) {

    		return this.multiplyQuaternions( q, this );

    	}

    	/**
    	 * Multiplies the given quaternions and stores the result in this instance.
    	 *
    	 * @param {Quaternion} a - The first quaternion.
    	 * @param {Quaternion} b - The second quaternion.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	multiplyQuaternions( a, b ) {

    		// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

    		const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    		const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;

    		this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    		this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    		this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    		this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Performs a spherical linear interpolation between this quaternion and the target quaternion.
    	 *
    	 * @param {Quaternion} qb - The target quaternion.
    	 * @param {number} t - The interpolation factor. A value in the range `[0,1]` will interpolate. A value outside the range `[0,1]` will extrapolate.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	slerp( qb, t ) {

    		let x = qb._x, y = qb._y, z = qb._z, w = qb._w;

    		let dot = this.dot( qb );

    		if ( dot < 0 ) {

    			x = - x;
    			y = - y;
    			z = - z;
    			w = - w;

    			dot = - dot;

    		}

    		let s = 1 - t;

    		if ( dot < 0.9995 ) {

    			// slerp

    			const theta = Math.acos( dot );
    			const sin = Math.sin( theta );

    			s = Math.sin( s * theta ) / sin;
    			t = Math.sin( t * theta ) / sin;

    			this._x = this._x * s + x * t;
    			this._y = this._y * s + y * t;
    			this._z = this._z * s + z * t;
    			this._w = this._w * s + w * t;

    			this._onChangeCallback();

    		} else {

    			// for small angles, lerp then normalize

    			this._x = this._x * s + x * t;
    			this._y = this._y * s + y * t;
    			this._z = this._z * s + z * t;
    			this._w = this._w * s + w * t;

    			this.normalize(); // normalize calls _onChangeCallback()

    		}

    		return this;

    	}

    	/**
    	 * Performs a spherical linear interpolation between the given quaternions
    	 * and stores the result in this quaternion.
    	 *
    	 * @param {Quaternion} qa - The source quaternion.
    	 * @param {Quaternion} qb - The target quaternion.
    	 * @param {number} t - The interpolation factor in the closed interval `[0, 1]`.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	slerpQuaternions( qa, qb, t ) {

    		return this.copy( qa ).slerp( qb, t );

    	}

    	/**
    	 * Sets this quaternion to a uniformly random, normalized quaternion.
    	 *
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	random() {

    		// Ken Shoemake
    		// Uniform random rotations
    		// D. Kirk, editor, Graphics Gems III, pages 124-132. Academic Press, New York, 1992.

    		const theta1 = 2 * Math.PI * Math.random();
    		const theta2 = 2 * Math.PI * Math.random();

    		const x0 = Math.random();
    		const r1 = Math.sqrt( 1 - x0 );
    		const r2 = Math.sqrt( x0 );

    		return this.set(
    			r1 * Math.sin( theta1 ),
    			r1 * Math.cos( theta1 ),
    			r2 * Math.sin( theta2 ),
    			r2 * Math.cos( theta2 ),
    		);

    	}

    	/**
    	 * Returns `true` if this quaternion is equal with the given one.
    	 *
    	 * @param {Quaternion} quaternion - The quaternion to test for equality.
    	 * @return {boolean} Whether this quaternion is equal with the given one.
    	 */
    	equals( quaternion ) {

    		return ( quaternion._x === this._x ) && ( quaternion._y === this._y ) && ( quaternion._z === this._z ) && ( quaternion._w === this._w );

    	}

    	/**
    	 * Sets this quaternion's components from the given array.
    	 *
    	 * @param {Array<number>} array - An array holding the quaternion component values.
    	 * @param {number} [offset=0] - The offset into the array.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	fromArray( array, offset = 0 ) {

    		this._x = array[ offset ];
    		this._y = array[ offset + 1 ];
    		this._z = array[ offset + 2 ];
    		this._w = array[ offset + 3 ];

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Writes the components of this quaternion to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the quaternion components.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The quaternion components.
    	 */
    	toArray( array = [], offset = 0 ) {

    		array[ offset ] = this._x;
    		array[ offset + 1 ] = this._y;
    		array[ offset + 2 ] = this._z;
    		array[ offset + 3 ] = this._w;

    		return array;

    	}

    	/**
    	 * Sets the components of this quaternion from the given buffer attribute.
    	 *
    	 * @param {BufferAttribute} attribute - The buffer attribute holding quaternion data.
    	 * @param {number} index - The index into the attribute.
    	 * @return {Quaternion} A reference to this quaternion.
    	 */
    	fromBufferAttribute( attribute, index ) {

    		this._x = attribute.getX( index );
    		this._y = attribute.getY( index );
    		this._z = attribute.getZ( index );
    		this._w = attribute.getW( index );

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * This methods defines the serialization result of this class. Returns the
    	 * numerical elements of this quaternion in an array of format `[x, y, z, w]`.
    	 *
    	 * @return {Array<number>} The serialized quaternion.
    	 */
    	toJSON() {

    		return this.toArray();

    	}

    	_onChange( callback ) {

    		this._onChangeCallback = callback;

    		return this;

    	}

    	_onChangeCallback() {}

    	*[ Symbol.iterator ]() {

    		yield this._x;
    		yield this._y;
    		yield this._z;
    		yield this._w;

    	}

    }

    /**
     * Class representing a 3D vector. A 3D vector is an ordered triplet of numbers
     * (labeled x, y and z), which can be used to represent a number of things, such as:
     *
     * - A point in 3D space.
     * - A direction and length in 3D space. In three.js the length will
     * always be the Euclidean distance(straight-line distance) from `(0, 0, 0)` to `(x, y, z)`
     * and the direction is also measured from `(0, 0, 0)` towards `(x, y, z)`.
     * - Any arbitrary ordered triplet of numbers.
     *
     * There are other things a 3D vector can be used to represent, such as
     * momentum vectors and so on, however these are the most
     * common uses in three.js.
     *
     * Iterating through a vector instance will yield its components `(x, y, z)` in
     * the corresponding order.
     * ```js
     * const a = new THREE.Vector3( 0, 1, 0 );
     *
     * //no arguments; will be initialised to (0, 0, 0)
     * const b = new THREE.Vector3( );
     *
     * const d = a.distanceTo( b );
     * ```
     */
    class Vector3 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Vector3.prototype.isVector3 = true;

    	}

    	/**
    	 * Constructs a new 3D vector.
    	 *
    	 * @param {number} [x=0] - The x value of this vector.
    	 * @param {number} [y=0] - The y value of this vector.
    	 * @param {number} [z=0] - The z value of this vector.
    	 */
    	constructor( x = 0, y = 0, z = 0 ) {

    		/**
    		 * The x value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.x = x;

    		/**
    		 * The y value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.y = y;

    		/**
    		 * The z value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.z = z;

    	}

    	/**
    	 * Sets the vector components.
    	 *
    	 * @param {number} x - The value of the x component.
    	 * @param {number} y - The value of the y component.
    	 * @param {number} z - The value of the z component.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	set( x, y, z ) {

    		if ( z === undefined ) z = this.z; // sprite.scale.set(x,y)

    		this.x = x;
    		this.y = y;
    		this.z = z;

    		return this;

    	}

    	/**
    	 * Sets the vector components to the same value.
    	 *
    	 * @param {number} scalar - The value to set for all vector components.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setScalar( scalar ) {

    		this.x = scalar;
    		this.y = scalar;
    		this.z = scalar;

    		return this;

    	}

    	/**
    	 * Sets the vector's x component to the given value.
    	 *
    	 * @param {number} x - The value to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setX( x ) {

    		this.x = x;

    		return this;

    	}

    	/**
    	 * Sets the vector's y component to the given value.
    	 *
    	 * @param {number} y - The value to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setY( y ) {

    		this.y = y;

    		return this;

    	}

    	/**
    	 * Sets the vector's z component to the given value.
    	 *
    	 * @param {number} z - The value to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setZ( z ) {

    		this.z = z;

    		return this;

    	}

    	/**
    	 * Allows to set a vector component with an index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
    	 * @param {number} value - The value to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setComponent( index, value ) {

    		switch ( index ) {

    			case 0: this.x = value; break;
    			case 1: this.y = value; break;
    			case 2: this.z = value; break;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    		return this;

    	}

    	/**
    	 * Returns the value of the vector component which matches the given index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
    	 * @return {number} A vector component value.
    	 */
    	getComponent( index ) {

    		switch ( index ) {

    			case 0: return this.x;
    			case 1: return this.y;
    			case 2: return this.z;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    	}

    	/**
    	 * Returns a new vector with copied values from this instance.
    	 *
    	 * @return {Vector3} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor( this.x, this.y, this.z );

    	}

    	/**
    	 * Copies the values of the given vector to this instance.
    	 *
    	 * @param {Vector3} v - The vector to copy.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	copy( v ) {

    		this.x = v.x;
    		this.y = v.y;
    		this.z = v.z;

    		return this;

    	}

    	/**
    	 * Adds the given vector to this instance.
    	 *
    	 * @param {Vector3} v - The vector to add.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	add( v ) {

    		this.x += v.x;
    		this.y += v.y;
    		this.z += v.z;

    		return this;

    	}

    	/**
    	 * Adds the given scalar value to all components of this instance.
    	 *
    	 * @param {number} s - The scalar to add.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	addScalar( s ) {

    		this.x += s;
    		this.y += s;
    		this.z += s;

    		return this;

    	}

    	/**
    	 * Adds the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector3} a - The first vector.
    	 * @param {Vector3} b - The second vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	addVectors( a, b ) {

    		this.x = a.x + b.x;
    		this.y = a.y + b.y;
    		this.z = a.z + b.z;

    		return this;

    	}

    	/**
    	 * Adds the given vector scaled by the given factor to this instance.
    	 *
    	 * @param {Vector3|Vector4} v - The vector.
    	 * @param {number} s - The factor that scales `v`.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	addScaledVector( v, s ) {

    		this.x += v.x * s;
    		this.y += v.y * s;
    		this.z += v.z * s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vector from this instance.
    	 *
    	 * @param {Vector3} v - The vector to subtract.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	sub( v ) {

    		this.x -= v.x;
    		this.y -= v.y;
    		this.z -= v.z;

    		return this;

    	}

    	/**
    	 * Subtracts the given scalar value from all components of this instance.
    	 *
    	 * @param {number} s - The scalar to subtract.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	subScalar( s ) {

    		this.x -= s;
    		this.y -= s;
    		this.z -= s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector3} a - The first vector.
    	 * @param {Vector3} b - The second vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	subVectors( a, b ) {

    		this.x = a.x - b.x;
    		this.y = a.y - b.y;
    		this.z = a.z - b.z;

    		return this;

    	}

    	/**
    	 * Multiplies the given vector with this instance.
    	 *
    	 * @param {Vector3} v - The vector to multiply.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	multiply( v ) {

    		this.x *= v.x;
    		this.y *= v.y;
    		this.z *= v.z;

    		return this;

    	}

    	/**
    	 * Multiplies the given scalar value with all components of this instance.
    	 *
    	 * @param {number} scalar - The scalar to multiply.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	multiplyScalar( scalar ) {

    		this.x *= scalar;
    		this.y *= scalar;
    		this.z *= scalar;

    		return this;

    	}

    	/**
    	 * Multiplies the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector3} a - The first vector.
    	 * @param {Vector3} b - The second vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	multiplyVectors( a, b ) {

    		this.x = a.x * b.x;
    		this.y = a.y * b.y;
    		this.z = a.z * b.z;

    		return this;

    	}

    	/**
    	 * Applies the given Euler rotation to this vector.
    	 *
    	 * @param {Euler} euler - The Euler angles.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyEuler( euler ) {

    		return this.applyQuaternion( _quaternion$5.setFromEuler( euler ) );

    	}

    	/**
    	 * Applies a rotation specified by an axis and an angle to this vector.
    	 *
    	 * @param {Vector3} axis - A normalized vector representing the rotation axis.
    	 * @param {number} angle - The angle in radians.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyAxisAngle( axis, angle ) {

    		return this.applyQuaternion( _quaternion$5.setFromAxisAngle( axis, angle ) );

    	}

    	/**
    	 * Multiplies this vector with the given 3x3 matrix.
    	 *
    	 * @param {Matrix3} m - The 3x3 matrix.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyMatrix3( m ) {

    		const x = this.x, y = this.y, z = this.z;
    		const e = m.elements;

    		this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ] * z;
    		this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ] * z;
    		this.z = e[ 2 ] * x + e[ 5 ] * y + e[ 8 ] * z;

    		return this;

    	}

    	/**
    	 * Multiplies this vector by the given normal matrix and normalizes
    	 * the result.
    	 *
    	 * @param {Matrix3} m - The normal matrix.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyNormalMatrix( m ) {

    		return this.applyMatrix3( m ).normalize();

    	}

    	/**
    	 * Multiplies this vector (with an implicit 1 in the 4th dimension) by m, and
    	 * divides by perspective.
    	 *
    	 * @param {Matrix4} m - The matrix to apply.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyMatrix4( m ) {

    		const x = this.x, y = this.y, z = this.z;
    		const e = m.elements;

    		const w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );

    		this.x = ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w;
    		this.y = ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w;
    		this.z = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w;

    		return this;

    	}

    	/**
    	 * Applies the given Quaternion to this vector.
    	 *
    	 * @param {Quaternion} q - The Quaternion.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	applyQuaternion( q ) {

    		// quaternion q is assumed to have unit length

    		const vx = this.x, vy = this.y, vz = this.z;
    		const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

    		// t = 2 * cross( q.xyz, v );
    		const tx = 2 * ( qy * vz - qz * vy );
    		const ty = 2 * ( qz * vx - qx * vz );
    		const tz = 2 * ( qx * vy - qy * vx );

    		// v + q.w * t + cross( q.xyz, t );
    		this.x = vx + qw * tx + qy * tz - qz * ty;
    		this.y = vy + qw * ty + qz * tx - qx * tz;
    		this.z = vz + qw * tz + qx * ty - qy * tx;

    		return this;

    	}

    	/**
    	 * Projects this vector from world space into the camera's normalized
    	 * device coordinate (NDC) space.
    	 *
    	 * @param {Camera} camera - The camera.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	project( camera ) {

    		return this.applyMatrix4( camera.matrixWorldInverse ).applyMatrix4( camera.projectionMatrix );

    	}

    	/**
    	 * Unprojects this vector from the camera's normalized device coordinate (NDC)
    	 * space into world space.
    	 *
    	 * @param {Camera} camera - The camera.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	unproject( camera ) {

    		return this.applyMatrix4( camera.projectionMatrixInverse ).applyMatrix4( camera.matrixWorld );

    	}

    	/**
    	 * Transforms the direction of this vector by a matrix (the upper left 3 x 3
    	 * subset of the given 4x4 matrix and then normalizes the result.
    	 *
    	 * @param {Matrix4} m - The matrix.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	transformDirection( m ) {

    		// input: THREE.Matrix4 affine matrix
    		// vector interpreted as a direction

    		const x = this.x, y = this.y, z = this.z;
    		const e = m.elements;

    		this.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z;
    		this.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z;
    		this.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z;

    		return this.normalize();

    	}

    	/**
    	 * Divides this instance by the given vector.
    	 *
    	 * @param {Vector3} v - The vector to divide.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	divide( v ) {

    		this.x /= v.x;
    		this.y /= v.y;
    		this.z /= v.z;

    		return this;

    	}

    	/**
    	 * Divides this vector by the given scalar.
    	 *
    	 * @param {number} scalar - The scalar to divide.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	divideScalar( scalar ) {

    		return this.multiplyScalar( 1 / scalar );

    	}

    	/**
    	 * If this vector's x, y or z value is greater than the given vector's x, y or z
    	 * value, replace that value with the corresponding min value.
    	 *
    	 * @param {Vector3} v - The vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	min( v ) {

    		this.x = Math.min( this.x, v.x );
    		this.y = Math.min( this.y, v.y );
    		this.z = Math.min( this.z, v.z );

    		return this;

    	}

    	/**
    	 * If this vector's x, y or z value is less than the given vector's x, y or z
    	 * value, replace that value with the corresponding max value.
    	 *
    	 * @param {Vector3} v - The vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	max( v ) {

    		this.x = Math.max( this.x, v.x );
    		this.y = Math.max( this.y, v.y );
    		this.z = Math.max( this.z, v.z );

    		return this;

    	}

    	/**
    	 * If this vector's x, y or z value is greater than the max vector's x, y or z
    	 * value, it is replaced by the corresponding value.
    	 * If this vector's x, y or z value is less than the min vector's x, y or z value,
    	 * it is replaced by the corresponding value.
    	 *
    	 * @param {Vector3} min - The minimum x, y and z values.
    	 * @param {Vector3} max - The maximum x, y and z values in the desired range.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	clamp( min, max ) {

    		// assumes min < max, componentwise

    		this.x = clamp( this.x, min.x, max.x );
    		this.y = clamp( this.y, min.y, max.y );
    		this.z = clamp( this.z, min.z, max.z );

    		return this;

    	}

    	/**
    	 * If this vector's x, y or z values are greater than the max value, they are
    	 * replaced by the max value.
    	 * If this vector's x, y or z values are less than the min value, they are
    	 * replaced by the min value.
    	 *
    	 * @param {number} minVal - The minimum value the components will be clamped to.
    	 * @param {number} maxVal - The maximum value the components will be clamped to.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	clampScalar( minVal, maxVal ) {

    		this.x = clamp( this.x, minVal, maxVal );
    		this.y = clamp( this.y, minVal, maxVal );
    		this.z = clamp( this.z, minVal, maxVal );

    		return this;

    	}

    	/**
    	 * If this vector's length is greater than the max value, it is replaced by
    	 * the max value.
    	 * If this vector's length is less than the min value, it is replaced by the
    	 * min value.
    	 *
    	 * @param {number} min - The minimum value the vector length will be clamped to.
    	 * @param {number} max - The maximum value the vector length will be clamped to.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	clampLength( min, max ) {

    		const length = this.length();

    		return this.divideScalar( length || 1 ).multiplyScalar( clamp( length, min, max ) );

    	}

    	/**
    	 * The components of this vector are rounded down to the nearest integer value.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	floor() {

    		this.x = Math.floor( this.x );
    		this.y = Math.floor( this.y );
    		this.z = Math.floor( this.z );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded up to the nearest integer value.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	ceil() {

    		this.x = Math.ceil( this.x );
    		this.y = Math.ceil( this.y );
    		this.z = Math.ceil( this.z );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded to the nearest integer value
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	round() {

    		this.x = Math.round( this.x );
    		this.y = Math.round( this.y );
    		this.z = Math.round( this.z );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded towards zero (up if negative,
    	 * down if positive) to an integer value.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	roundToZero() {

    		this.x = Math.trunc( this.x );
    		this.y = Math.trunc( this.y );
    		this.z = Math.trunc( this.z );

    		return this;

    	}

    	/**
    	 * Inverts this vector - i.e. sets x = -x, y = -y and z = -z.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	negate() {

    		this.x = - this.x;
    		this.y = - this.y;
    		this.z = - this.z;

    		return this;

    	}

    	/**
    	 * Calculates the dot product of the given vector with this instance.
    	 *
    	 * @param {Vector3} v - The vector to compute the dot product with.
    	 * @return {number} The result of the dot product.
    	 */
    	dot( v ) {

    		return this.x * v.x + this.y * v.y + this.z * v.z;

    	}

    	/**
    	 * Computes the square of the Euclidean length (straight-line length) from
    	 * (0, 0, 0) to (x, y, z). If you are comparing the lengths of vectors, you should
    	 * compare the length squared instead as it is slightly more efficient to calculate.
    	 *
    	 * @return {number} The square length of this vector.
    	 */
    	lengthSq() {

    		return this.x * this.x + this.y * this.y + this.z * this.z;

    	}

    	/**
    	 * Computes the  Euclidean length (straight-line length) from (0, 0, 0) to (x, y, z).
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	length() {

    		return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );

    	}

    	/**
    	 * Computes the Manhattan length of this vector.
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	manhattanLength() {

    		return Math.abs( this.x ) + Math.abs( this.y ) + Math.abs( this.z );

    	}

    	/**
    	 * Converts this vector to a unit vector - that is, sets it equal to a vector
    	 * with the same direction as this one, but with a vector length of `1`.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	normalize() {

    		return this.divideScalar( this.length() || 1 );

    	}

    	/**
    	 * Sets this vector to a vector with the same direction as this one, but
    	 * with the specified length.
    	 *
    	 * @param {number} length - The new length of this vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setLength( length ) {

    		return this.normalize().multiplyScalar( length );

    	}

    	/**
    	 * Linearly interpolates between the given vector and this instance, where
    	 * alpha is the percent distance along the line - alpha = 0 will be this
    	 * vector, and alpha = 1 will be the given one.
    	 *
    	 * @param {Vector3} v - The vector to interpolate towards.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	lerp( v, alpha ) {

    		this.x += ( v.x - this.x ) * alpha;
    		this.y += ( v.y - this.y ) * alpha;
    		this.z += ( v.z - this.z ) * alpha;

    		return this;

    	}

    	/**
    	 * Linearly interpolates between the given vectors, where alpha is the percent
    	 * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
    	 * be the second one. The result is stored in this instance.
    	 *
    	 * @param {Vector3} v1 - The first vector.
    	 * @param {Vector3} v2 - The second vector.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	lerpVectors( v1, v2, alpha ) {

    		this.x = v1.x + ( v2.x - v1.x ) * alpha;
    		this.y = v1.y + ( v2.y - v1.y ) * alpha;
    		this.z = v1.z + ( v2.z - v1.z ) * alpha;

    		return this;

    	}

    	/**
    	 * Calculates the cross product of the given vector with this instance.
    	 *
    	 * @param {Vector3} v - The vector to compute the cross product with.
    	 * @return {Vector3} The result of the cross product.
    	 */
    	cross( v ) {

    		return this.crossVectors( this, v );

    	}

    	/**
    	 * Calculates the cross product of the given vectors and stores the result
    	 * in this instance.
    	 *
    	 * @param {Vector3} a - The first vector.
    	 * @param {Vector3} b - The second vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	crossVectors( a, b ) {

    		const ax = a.x, ay = a.y, az = a.z;
    		const bx = b.x, by = b.y, bz = b.z;

    		this.x = ay * bz - az * by;
    		this.y = az * bx - ax * bz;
    		this.z = ax * by - ay * bx;

    		return this;

    	}

    	/**
    	 * Projects this vector onto the given one.
    	 *
    	 * @param {Vector3} v - The vector to project to.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	projectOnVector( v ) {

    		const denominator = v.lengthSq();

    		if ( denominator === 0 ) return this.set( 0, 0, 0 );

    		const scalar = v.dot( this ) / denominator;

    		return this.copy( v ).multiplyScalar( scalar );

    	}

    	/**
    	 * Projects this vector onto a plane by subtracting this
    	 * vector projected onto the plane's normal from this vector.
    	 *
    	 * @param {Vector3} planeNormal - The plane normal.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	projectOnPlane( planeNormal ) {

    		_vector$c.copy( this ).projectOnVector( planeNormal );

    		return this.sub( _vector$c );

    	}

    	/**
    	 * Reflects this vector off a plane orthogonal to the given normal vector.
    	 *
    	 * @param {Vector3} normal - The (normalized) normal vector.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	reflect( normal ) {

    		return this.sub( _vector$c.copy( normal ).multiplyScalar( 2 * this.dot( normal ) ) );

    	}
    	/**
    	 * Returns the angle between the given vector and this instance in radians.
    	 *
    	 * @param {Vector3} v - The vector to compute the angle with.
    	 * @return {number} The angle in radians.
    	 */
    	angleTo( v ) {

    		const denominator = Math.sqrt( this.lengthSq() * v.lengthSq() );

    		if ( denominator === 0 ) return Math.PI / 2;

    		const theta = this.dot( v ) / denominator;

    		// clamp, to handle numerical problems

    		return Math.acos( clamp( theta, -1, 1 ) );

    	}

    	/**
    	 * Computes the distance from the given vector to this instance.
    	 *
    	 * @param {Vector3} v - The vector to compute the distance to.
    	 * @return {number} The distance.
    	 */
    	distanceTo( v ) {

    		return Math.sqrt( this.distanceToSquared( v ) );

    	}

    	/**
    	 * Computes the squared distance from the given vector to this instance.
    	 * If you are just comparing the distance with another distance, you should compare
    	 * the distance squared instead as it is slightly more efficient to calculate.
    	 *
    	 * @param {Vector3} v - The vector to compute the squared distance to.
    	 * @return {number} The squared distance.
    	 */
    	distanceToSquared( v ) {

    		const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;

    		return dx * dx + dy * dy + dz * dz;

    	}

    	/**
    	 * Computes the Manhattan distance from the given vector to this instance.
    	 *
    	 * @param {Vector3} v - The vector to compute the Manhattan distance to.
    	 * @return {number} The Manhattan distance.
    	 */
    	manhattanDistanceTo( v ) {

    		return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y ) + Math.abs( this.z - v.z );

    	}

    	/**
    	 * Sets the vector components from the given spherical coordinates.
    	 *
    	 * @param {Spherical} s - The spherical coordinates.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromSpherical( s ) {

    		return this.setFromSphericalCoords( s.radius, s.phi, s.theta );

    	}

    	/**
    	 * Sets the vector components from the given spherical coordinates.
    	 *
    	 * @param {number} radius - The radius.
    	 * @param {number} phi - The phi angle in radians.
    	 * @param {number} theta - The theta angle in radians.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromSphericalCoords( radius, phi, theta ) {

    		const sinPhiRadius = Math.sin( phi ) * radius;

    		this.x = sinPhiRadius * Math.sin( theta );
    		this.y = Math.cos( phi ) * radius;
    		this.z = sinPhiRadius * Math.cos( theta );

    		return this;

    	}

    	/**
    	 * Sets the vector components from the given cylindrical coordinates.
    	 *
    	 * @param {Cylindrical} c - The cylindrical coordinates.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromCylindrical( c ) {

    		return this.setFromCylindricalCoords( c.radius, c.theta, c.y );

    	}

    	/**
    	 * Sets the vector components from the given cylindrical coordinates.
    	 *
    	 * @param {number} radius - The radius.
    	 * @param {number} theta - The theta angle in radians.
    	 * @param {number} y - The y value.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromCylindricalCoords( radius, theta, y ) {

    		this.x = radius * Math.sin( theta );
    		this.y = y;
    		this.z = radius * Math.cos( theta );

    		return this;

    	}

    	/**
    	 * Sets the vector components to the position elements of the
    	 * given transformation matrix.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromMatrixPosition( m ) {

    		const e = m.elements;

    		this.x = e[ 12 ];
    		this.y = e[ 13 ];
    		this.z = e[ 14 ];

    		return this;

    	}

    	/**
    	 * Sets the vector components to the scale elements of the
    	 * given transformation matrix.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromMatrixScale( m ) {

    		const sx = this.setFromMatrixColumn( m, 0 ).length();
    		const sy = this.setFromMatrixColumn( m, 1 ).length();
    		const sz = this.setFromMatrixColumn( m, 2 ).length();

    		this.x = sx;
    		this.y = sy;
    		this.z = sz;

    		return this;

    	}

    	/**
    	 * Sets the vector components from the specified matrix column.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @param {number} index - The column index.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromMatrixColumn( m, index ) {

    		return this.fromArray( m.elements, index * 4 );

    	}

    	/**
    	 * Sets the vector components from the specified matrix column.
    	 *
    	 * @param {Matrix3} m - The 3x3 matrix.
    	 * @param {number} index - The column index.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromMatrix3Column( m, index ) {

    		return this.fromArray( m.elements, index * 3 );

    	}

    	/**
    	 * Sets the vector components from the given Euler angles.
    	 *
    	 * @param {Euler} e - The Euler angles to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromEuler( e ) {

    		this.x = e._x;
    		this.y = e._y;
    		this.z = e._z;

    		return this;

    	}

    	/**
    	 * Sets the vector components from the RGB components of the
    	 * given color.
    	 *
    	 * @param {Color} c - The color to set.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	setFromColor( c ) {

    		this.x = c.r;
    		this.y = c.g;
    		this.z = c.b;

    		return this;

    	}

    	/**
    	 * Returns `true` if this vector is equal with the given one.
    	 *
    	 * @param {Vector3} v - The vector to test for equality.
    	 * @return {boolean} Whether this vector is equal with the given one.
    	 */
    	equals( v ) {

    		return ( ( v.x === this.x ) && ( v.y === this.y ) && ( v.z === this.z ) );

    	}

    	/**
    	 * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`
    	 * and z value to be `array[ offset + 2 ]`.
    	 *
    	 * @param {Array<number>} array - An array holding the vector component values.
    	 * @param {number} [offset=0] - The offset into the array.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	fromArray( array, offset = 0 ) {

    		this.x = array[ offset ];
    		this.y = array[ offset + 1 ];
    		this.z = array[ offset + 2 ];

    		return this;

    	}

    	/**
    	 * Writes the components of this vector to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the vector components.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The vector components.
    	 */
    	toArray( array = [], offset = 0 ) {

    		array[ offset ] = this.x;
    		array[ offset + 1 ] = this.y;
    		array[ offset + 2 ] = this.z;

    		return array;

    	}

    	/**
    	 * Sets the components of this vector from the given buffer attribute.
    	 *
    	 * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
    	 * @param {number} index - The index into the attribute.
    	 * @return {Vector3} A reference to this vector.
    	 */
    	fromBufferAttribute( attribute, index ) {

    		this.x = attribute.getX( index );
    		this.y = attribute.getY( index );
    		this.z = attribute.getZ( index );

    		return this;

    	}

    	/**
    	 * Sets each component of this vector to a pseudo-random value between `0` and
    	 * `1`, excluding `1`.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	random() {

    		this.x = Math.random();
    		this.y = Math.random();
    		this.z = Math.random();

    		return this;

    	}

    	/**
    	 * Sets this vector to a uniformly random point on a unit sphere.
    	 *
    	 * @return {Vector3} A reference to this vector.
    	 */
    	randomDirection() {

    		// https://mathworld.wolfram.com/SpherePointPicking.html

    		const theta = Math.random() * Math.PI * 2;
    		const u = Math.random() * 2 - 1;
    		const c = Math.sqrt( 1 - u * u );

    		this.x = c * Math.cos( theta );
    		this.y = u;
    		this.z = c * Math.sin( theta );

    		return this;

    	}

    	*[ Symbol.iterator ]() {

    		yield this.x;
    		yield this.y;
    		yield this.z;

    	}

    }

    const _vector$c = /*@__PURE__*/ new Vector3();
    const _quaternion$5 = /*@__PURE__*/ new Quaternion();

    /**
     * Represents a 3x3 matrix.
     *
     * A Note on Row-Major and Column-Major Ordering:
     *
     * The constructor and {@link Matrix3#set} method take arguments in
     * [row-major](https://en.wikipedia.org/wiki/Row-_and_column-major_order#Column-major_order)
     * order, while internally they are stored in the {@link Matrix3#elements} array in column-major order.
     * This means that calling:
     * ```js
     * const m = new THREE.Matrix();
     * m.set( 11, 12, 13,
     *        21, 22, 23,
     *        31, 32, 33 );
     * ```
     * will result in the elements array containing:
     * ```js
     * m.elements = [ 11, 21, 31,
     *                12, 22, 32,
     *                13, 23, 33 ];
     * ```
     * and internally all calculations are performed using column-major ordering.
     * However, as the actual ordering makes no difference mathematically and
     * most people are used to thinking about matrices in row-major order, the
     * three.js documentation shows matrices in row-major order. Just bear in
     * mind that if you are reading the source code, you'll have to take the
     * transpose of any matrices outlined here to make sense of the calculations.
     */
    class Matrix3 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Matrix3.prototype.isMatrix3 = true;

    	}

    	/**
    	 * Constructs a new 3x3 matrix. The arguments are supposed to be
    	 * in row-major order. If no arguments are provided, the constructor
    	 * initializes the matrix as an identity matrix.
    	 *
    	 * @param {number} [n11] - 1-1 matrix element.
    	 * @param {number} [n12] - 1-2 matrix element.
    	 * @param {number} [n13] - 1-3 matrix element.
    	 * @param {number} [n21] - 2-1 matrix element.
    	 * @param {number} [n22] - 2-2 matrix element.
    	 * @param {number} [n23] - 2-3 matrix element.
    	 * @param {number} [n31] - 3-1 matrix element.
    	 * @param {number} [n32] - 3-2 matrix element.
    	 * @param {number} [n33] - 3-3 matrix element.
    	 */
    	constructor( n11, n12, n13, n21, n22, n23, n31, n32, n33 ) {

    		/**
    		 * A column-major list of matrix values.
    		 *
    		 * @type {Array<number>}
    		 */
    		this.elements = [

    			1, 0, 0,
    			0, 1, 0,
    			0, 0, 1

    		];

    		if ( n11 !== undefined ) {

    			this.set( n11, n12, n13, n21, n22, n23, n31, n32, n33 );

    		}

    	}

    	/**
    	 * Sets the elements of the matrix.The arguments are supposed to be
    	 * in row-major order.
    	 *
    	 * @param {number} [n11] - 1-1 matrix element.
    	 * @param {number} [n12] - 1-2 matrix element.
    	 * @param {number} [n13] - 1-3 matrix element.
    	 * @param {number} [n21] - 2-1 matrix element.
    	 * @param {number} [n22] - 2-2 matrix element.
    	 * @param {number} [n23] - 2-3 matrix element.
    	 * @param {number} [n31] - 3-1 matrix element.
    	 * @param {number} [n32] - 3-2 matrix element.
    	 * @param {number} [n33] - 3-3 matrix element.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	set( n11, n12, n13, n21, n22, n23, n31, n32, n33 ) {

    		const te = this.elements;

    		te[ 0 ] = n11; te[ 1 ] = n21; te[ 2 ] = n31;
    		te[ 3 ] = n12; te[ 4 ] = n22; te[ 5 ] = n32;
    		te[ 6 ] = n13; te[ 7 ] = n23; te[ 8 ] = n33;

    		return this;

    	}

    	/**
    	 * Sets this matrix to the 3x3 identity matrix.
    	 *
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	identity() {

    		this.set(

    			1, 0, 0,
    			0, 1, 0,
    			0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Copies the values of the given matrix to this instance.
    	 *
    	 * @param {Matrix3} m - The matrix to copy.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	copy( m ) {

    		const te = this.elements;
    		const me = m.elements;

    		te[ 0 ] = me[ 0 ]; te[ 1 ] = me[ 1 ]; te[ 2 ] = me[ 2 ];
    		te[ 3 ] = me[ 3 ]; te[ 4 ] = me[ 4 ]; te[ 5 ] = me[ 5 ];
    		te[ 6 ] = me[ 6 ]; te[ 7 ] = me[ 7 ]; te[ 8 ] = me[ 8 ];

    		return this;

    	}

    	/**
    	 * Extracts the basis of this matrix into the three axis vectors provided.
    	 *
    	 * @param {Vector3} xAxis - The basis's x axis.
    	 * @param {Vector3} yAxis - The basis's y axis.
    	 * @param {Vector3} zAxis - The basis's z axis.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	extractBasis( xAxis, yAxis, zAxis ) {

    		xAxis.setFromMatrix3Column( this, 0 );
    		yAxis.setFromMatrix3Column( this, 1 );
    		zAxis.setFromMatrix3Column( this, 2 );

    		return this;

    	}

    	/**
    	 * Set this matrix to the upper 3x3 matrix of the given 4x4 matrix.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	setFromMatrix4( m ) {

    		const me = m.elements;

    		this.set(

    			me[ 0 ], me[ 4 ], me[ 8 ],
    			me[ 1 ], me[ 5 ], me[ 9 ],
    			me[ 2 ], me[ 6 ], me[ 10 ]

    		);

    		return this;

    	}

    	/**
    	 * Post-multiplies this matrix by the given 3x3 matrix.
    	 *
    	 * @param {Matrix3} m - The matrix to multiply with.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	multiply( m ) {

    		return this.multiplyMatrices( this, m );

    	}

    	/**
    	 * Pre-multiplies this matrix by the given 3x3 matrix.
    	 *
    	 * @param {Matrix3} m - The matrix to multiply with.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	premultiply( m ) {

    		return this.multiplyMatrices( m, this );

    	}

    	/**
    	 * Multiples the given 3x3 matrices and stores the result
    	 * in this matrix.
    	 *
    	 * @param {Matrix3} a - The first matrix.
    	 * @param {Matrix3} b - The second matrix.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	multiplyMatrices( a, b ) {

    		const ae = a.elements;
    		const be = b.elements;
    		const te = this.elements;

    		const a11 = ae[ 0 ], a12 = ae[ 3 ], a13 = ae[ 6 ];
    		const a21 = ae[ 1 ], a22 = ae[ 4 ], a23 = ae[ 7 ];
    		const a31 = ae[ 2 ], a32 = ae[ 5 ], a33 = ae[ 8 ];

    		const b11 = be[ 0 ], b12 = be[ 3 ], b13 = be[ 6 ];
    		const b21 = be[ 1 ], b22 = be[ 4 ], b23 = be[ 7 ];
    		const b31 = be[ 2 ], b32 = be[ 5 ], b33 = be[ 8 ];

    		te[ 0 ] = a11 * b11 + a12 * b21 + a13 * b31;
    		te[ 3 ] = a11 * b12 + a12 * b22 + a13 * b32;
    		te[ 6 ] = a11 * b13 + a12 * b23 + a13 * b33;

    		te[ 1 ] = a21 * b11 + a22 * b21 + a23 * b31;
    		te[ 4 ] = a21 * b12 + a22 * b22 + a23 * b32;
    		te[ 7 ] = a21 * b13 + a22 * b23 + a23 * b33;

    		te[ 2 ] = a31 * b11 + a32 * b21 + a33 * b31;
    		te[ 5 ] = a31 * b12 + a32 * b22 + a33 * b32;
    		te[ 8 ] = a31 * b13 + a32 * b23 + a33 * b33;

    		return this;

    	}

    	/**
    	 * Multiplies every component of the matrix by the given scalar.
    	 *
    	 * @param {number} s - The scalar.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	multiplyScalar( s ) {

    		const te = this.elements;

    		te[ 0 ] *= s; te[ 3 ] *= s; te[ 6 ] *= s;
    		te[ 1 ] *= s; te[ 4 ] *= s; te[ 7 ] *= s;
    		te[ 2 ] *= s; te[ 5 ] *= s; te[ 8 ] *= s;

    		return this;

    	}

    	/**
    	 * Computes and returns the determinant of this matrix.
    	 *
    	 * @return {number} The determinant.
    	 */
    	determinant() {

    		const te = this.elements;

    		const a = te[ 0 ], b = te[ 1 ], c = te[ 2 ],
    			d = te[ 3 ], e = te[ 4 ], f = te[ 5 ],
    			g = te[ 6 ], h = te[ 7 ], i = te[ 8 ];

    		return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;

    	}

    	/**
    	 * Inverts this matrix, using the [analytic method](https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution).
    	 * You can not invert with a determinant of zero. If you attempt this, the method produces
    	 * a zero matrix instead.
    	 *
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	invert() {

    		const te = this.elements,

    			n11 = te[ 0 ], n21 = te[ 1 ], n31 = te[ 2 ],
    			n12 = te[ 3 ], n22 = te[ 4 ], n32 = te[ 5 ],
    			n13 = te[ 6 ], n23 = te[ 7 ], n33 = te[ 8 ],

    			t11 = n33 * n22 - n32 * n23,
    			t12 = n32 * n13 - n33 * n12,
    			t13 = n23 * n12 - n22 * n13,

    			det = n11 * t11 + n21 * t12 + n31 * t13;

    		if ( det === 0 ) return this.set( 0, 0, 0, 0, 0, 0, 0, 0, 0 );

    		const detInv = 1 / det;

    		te[ 0 ] = t11 * detInv;
    		te[ 1 ] = ( n31 * n23 - n33 * n21 ) * detInv;
    		te[ 2 ] = ( n32 * n21 - n31 * n22 ) * detInv;

    		te[ 3 ] = t12 * detInv;
    		te[ 4 ] = ( n33 * n11 - n31 * n13 ) * detInv;
    		te[ 5 ] = ( n31 * n12 - n32 * n11 ) * detInv;

    		te[ 6 ] = t13 * detInv;
    		te[ 7 ] = ( n21 * n13 - n23 * n11 ) * detInv;
    		te[ 8 ] = ( n22 * n11 - n21 * n12 ) * detInv;

    		return this;

    	}

    	/**
    	 * Transposes this matrix in place.
    	 *
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	transpose() {

    		let tmp;
    		const m = this.elements;

    		tmp = m[ 1 ]; m[ 1 ] = m[ 3 ]; m[ 3 ] = tmp;
    		tmp = m[ 2 ]; m[ 2 ] = m[ 6 ]; m[ 6 ] = tmp;
    		tmp = m[ 5 ]; m[ 5 ] = m[ 7 ]; m[ 7 ] = tmp;

    		return this;

    	}

    	/**
    	 * Computes the normal matrix which is the inverse transpose of the upper
    	 * left 3x3 portion of the given 4x4 matrix.
    	 *
    	 * @param {Matrix4} matrix4 - The 4x4 matrix.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	getNormalMatrix( matrix4 ) {

    		return this.setFromMatrix4( matrix4 ).invert().transpose();

    	}

    	/**
    	 * Transposes this matrix into the supplied array, and returns itself unchanged.
    	 *
    	 * @param {Array<number>} r - An array to store the transposed matrix elements.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	transposeIntoArray( r ) {

    		const m = this.elements;

    		r[ 0 ] = m[ 0 ];
    		r[ 1 ] = m[ 3 ];
    		r[ 2 ] = m[ 6 ];
    		r[ 3 ] = m[ 1 ];
    		r[ 4 ] = m[ 4 ];
    		r[ 5 ] = m[ 7 ];
    		r[ 6 ] = m[ 2 ];
    		r[ 7 ] = m[ 5 ];
    		r[ 8 ] = m[ 8 ];

    		return this;

    	}

    	/**
    	 * Sets the UV transform matrix from offset, repeat, rotation, and center.
    	 *
    	 * @param {number} tx - Offset x.
    	 * @param {number} ty - Offset y.
    	 * @param {number} sx - Repeat x.
    	 * @param {number} sy - Repeat y.
    	 * @param {number} rotation - Rotation, in radians. Positive values rotate counterclockwise.
    	 * @param {number} cx - Center x of rotation.
    	 * @param {number} cy - Center y of rotation
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	setUvTransform( tx, ty, sx, sy, rotation, cx, cy ) {

    		const c = Math.cos( rotation );
    		const s = Math.sin( rotation );

    		this.set(
    			sx * c, sx * s, - sx * ( c * cx + s * cy ) + cx + tx,
    			- sy * s, sy * c, - sy * ( - s * cx + c * cy ) + cy + ty,
    			0, 0, 1
    		);

    		return this;

    	}

    	/**
    	 * Scales this matrix with the given scalar values.
    	 *
    	 * @param {number} sx - The amount to scale in the X axis.
    	 * @param {number} sy - The amount to scale in the Y axis.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	scale( sx, sy ) {

    		this.premultiply( _m3.makeScale( sx, sy ) );

    		return this;

    	}

    	/**
    	 * Rotates this matrix by the given angle.
    	 *
    	 * @param {number} theta - The rotation in radians.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	rotate( theta ) {

    		this.premultiply( _m3.makeRotation( - theta ) );

    		return this;

    	}

    	/**
    	 * Translates this matrix by the given scalar values.
    	 *
    	 * @param {number} tx - The amount to translate in the X axis.
    	 * @param {number} ty - The amount to translate in the Y axis.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	translate( tx, ty ) {

    		this.premultiply( _m3.makeTranslation( tx, ty ) );

    		return this;

    	}

    	// for 2D Transforms

    	/**
    	 * Sets this matrix as a 2D translation transform.
    	 *
    	 * @param {number|Vector2} x - The amount to translate in the X axis or alternatively a translation vector.
    	 * @param {number} y - The amount to translate in the Y axis.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	makeTranslation( x, y ) {

    		if ( x.isVector2 ) {

    			this.set(

    				1, 0, x.x,
    				0, 1, x.y,
    				0, 0, 1

    			);

    		} else {

    			this.set(

    				1, 0, x,
    				0, 1, y,
    				0, 0, 1

    			);

    		}

    		return this;

    	}

    	/**
    	 * Sets this matrix as a 2D rotational transformation.
    	 *
    	 * @param {number} theta - The rotation in radians.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	makeRotation( theta ) {

    		// counterclockwise

    		const c = Math.cos( theta );
    		const s = Math.sin( theta );

    		this.set(

    			c, - s, 0,
    			s, c, 0,
    			0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a 2D scale transform.
    	 *
    	 * @param {number} x - The amount to scale in the X axis.
    	 * @param {number} y - The amount to scale in the Y axis.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	makeScale( x, y ) {

    		this.set(

    			x, 0, 0,
    			0, y, 0,
    			0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Returns `true` if this matrix is equal with the given one.
    	 *
    	 * @param {Matrix3} matrix - The matrix to test for equality.
    	 * @return {boolean} Whether this matrix is equal with the given one.
    	 */
    	equals( matrix ) {

    		const te = this.elements;
    		const me = matrix.elements;

    		for ( let i = 0; i < 9; i ++ ) {

    			if ( te[ i ] !== me[ i ] ) return false;

    		}

    		return true;

    	}

    	/**
    	 * Sets the elements of the matrix from the given array.
    	 *
    	 * @param {Array<number>} array - The matrix elements in column-major order.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Matrix3} A reference to this matrix.
    	 */
    	fromArray( array, offset = 0 ) {

    		for ( let i = 0; i < 9; i ++ ) {

    			this.elements[ i ] = array[ i + offset ];

    		}

    		return this;

    	}

    	/**
    	 * Writes the elements of this matrix to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the matrix elements in column-major order.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The matrix elements in column-major order.
    	 */
    	toArray( array = [], offset = 0 ) {

    		const te = this.elements;

    		array[ offset ] = te[ 0 ];
    		array[ offset + 1 ] = te[ 1 ];
    		array[ offset + 2 ] = te[ 2 ];

    		array[ offset + 3 ] = te[ 3 ];
    		array[ offset + 4 ] = te[ 4 ];
    		array[ offset + 5 ] = te[ 5 ];

    		array[ offset + 6 ] = te[ 6 ];
    		array[ offset + 7 ] = te[ 7 ];
    		array[ offset + 8 ] = te[ 8 ];

    		return array;

    	}

    	/**
    	 * Returns a matrix with copied values from this instance.
    	 *
    	 * @return {Matrix3} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor().fromArray( this.elements );

    	}

    }

    const _m3 = /*@__PURE__*/ new Matrix3();

    /**
     * Class representing a 4D vector. A 4D vector is an ordered quadruplet of numbers
     * (labeled x, y, z and w), which can be used to represent a number of things, such as:
     *
     * - A point in 4D space.
     * - A direction and length in 4D space. In three.js the length will
     * always be the Euclidean distance(straight-line distance) from `(0, 0, 0, 0)` to `(x, y, z, w)`
     * and the direction is also measured from `(0, 0, 0, 0)` towards `(x, y, z, w)`.
     * - Any arbitrary ordered quadruplet of numbers.
     *
     * There are other things a 4D vector can be used to represent, however these
     * are the most common uses in *three.js*.
     *
     * Iterating through a vector instance will yield its components `(x, y, z, w)` in
     * the corresponding order.
     * ```js
     * const a = new THREE.Vector4( 0, 1, 0, 0 );
     *
     * //no arguments; will be initialised to (0, 0, 0, 1)
     * const b = new THREE.Vector4( );
     *
     * const d = a.dot( b );
     * ```
     */
    class Vector4 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Vector4.prototype.isVector4 = true;

    	}

    	/**
    	 * Constructs a new 4D vector.
    	 *
    	 * @param {number} [x=0] - The x value of this vector.
    	 * @param {number} [y=0] - The y value of this vector.
    	 * @param {number} [z=0] - The z value of this vector.
    	 * @param {number} [w=1] - The w value of this vector.
    	 */
    	constructor( x = 0, y = 0, z = 0, w = 1 ) {

    		/**
    		 * The x value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.x = x;

    		/**
    		 * The y value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.y = y;

    		/**
    		 * The z value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.z = z;

    		/**
    		 * The w value of this vector.
    		 *
    		 * @type {number}
    		 */
    		this.w = w;

    	}

    	/**
    	 * Alias for {@link Vector4#z}.
    	 *
    	 * @type {number}
    	 */
    	get width() {

    		return this.z;

    	}

    	set width( value ) {

    		this.z = value;

    	}

    	/**
    	 * Alias for {@link Vector4#w}.
    	 *
    	 * @type {number}
    	 */
    	get height() {

    		return this.w;

    	}

    	set height( value ) {

    		this.w = value;

    	}

    	/**
    	 * Sets the vector components.
    	 *
    	 * @param {number} x - The value of the x component.
    	 * @param {number} y - The value of the y component.
    	 * @param {number} z - The value of the z component.
    	 * @param {number} w - The value of the w component.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	set( x, y, z, w ) {

    		this.x = x;
    		this.y = y;
    		this.z = z;
    		this.w = w;

    		return this;

    	}

    	/**
    	 * Sets the vector components to the same value.
    	 *
    	 * @param {number} scalar - The value to set for all vector components.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setScalar( scalar ) {

    		this.x = scalar;
    		this.y = scalar;
    		this.z = scalar;
    		this.w = scalar;

    		return this;

    	}

    	/**
    	 * Sets the vector's x component to the given value
    	 *
    	 * @param {number} x - The value to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setX( x ) {

    		this.x = x;

    		return this;

    	}

    	/**
    	 * Sets the vector's y component to the given value
    	 *
    	 * @param {number} y - The value to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setY( y ) {

    		this.y = y;

    		return this;

    	}

    	/**
    	 * Sets the vector's z component to the given value
    	 *
    	 * @param {number} z - The value to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setZ( z ) {

    		this.z = z;

    		return this;

    	}

    	/**
    	 * Sets the vector's w component to the given value
    	 *
    	 * @param {number} w - The value to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setW( w ) {

    		this.w = w;

    		return this;

    	}

    	/**
    	 * Allows to set a vector component with an index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y,
    	 * `2` equals to z, `3` equals to w.
    	 * @param {number} value - The value to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setComponent( index, value ) {

    		switch ( index ) {

    			case 0: this.x = value; break;
    			case 1: this.y = value; break;
    			case 2: this.z = value; break;
    			case 3: this.w = value; break;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    		return this;

    	}

    	/**
    	 * Returns the value of the vector component which matches the given index.
    	 *
    	 * @param {number} index - The component index. `0` equals to x, `1` equals to y,
    	 * `2` equals to z, `3` equals to w.
    	 * @return {number} A vector component value.
    	 */
    	getComponent( index ) {

    		switch ( index ) {

    			case 0: return this.x;
    			case 1: return this.y;
    			case 2: return this.z;
    			case 3: return this.w;
    			default: throw new Error( 'index is out of range: ' + index );

    		}

    	}

    	/**
    	 * Returns a new vector with copied values from this instance.
    	 *
    	 * @return {Vector4} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor( this.x, this.y, this.z, this.w );

    	}

    	/**
    	 * Copies the values of the given vector to this instance.
    	 *
    	 * @param {Vector3|Vector4} v - The vector to copy.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	copy( v ) {

    		this.x = v.x;
    		this.y = v.y;
    		this.z = v.z;
    		this.w = ( v.w !== undefined ) ? v.w : 1;

    		return this;

    	}

    	/**
    	 * Adds the given vector to this instance.
    	 *
    	 * @param {Vector4} v - The vector to add.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	add( v ) {

    		this.x += v.x;
    		this.y += v.y;
    		this.z += v.z;
    		this.w += v.w;

    		return this;

    	}

    	/**
    	 * Adds the given scalar value to all components of this instance.
    	 *
    	 * @param {number} s - The scalar to add.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	addScalar( s ) {

    		this.x += s;
    		this.y += s;
    		this.z += s;
    		this.w += s;

    		return this;

    	}

    	/**
    	 * Adds the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector4} a - The first vector.
    	 * @param {Vector4} b - The second vector.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	addVectors( a, b ) {

    		this.x = a.x + b.x;
    		this.y = a.y + b.y;
    		this.z = a.z + b.z;
    		this.w = a.w + b.w;

    		return this;

    	}

    	/**
    	 * Adds the given vector scaled by the given factor to this instance.
    	 *
    	 * @param {Vector4} v - The vector.
    	 * @param {number} s - The factor that scales `v`.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	addScaledVector( v, s ) {

    		this.x += v.x * s;
    		this.y += v.y * s;
    		this.z += v.z * s;
    		this.w += v.w * s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vector from this instance.
    	 *
    	 * @param {Vector4} v - The vector to subtract.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	sub( v ) {

    		this.x -= v.x;
    		this.y -= v.y;
    		this.z -= v.z;
    		this.w -= v.w;

    		return this;

    	}

    	/**
    	 * Subtracts the given scalar value from all components of this instance.
    	 *
    	 * @param {number} s - The scalar to subtract.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	subScalar( s ) {

    		this.x -= s;
    		this.y -= s;
    		this.z -= s;
    		this.w -= s;

    		return this;

    	}

    	/**
    	 * Subtracts the given vectors and stores the result in this instance.
    	 *
    	 * @param {Vector4} a - The first vector.
    	 * @param {Vector4} b - The second vector.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	subVectors( a, b ) {

    		this.x = a.x - b.x;
    		this.y = a.y - b.y;
    		this.z = a.z - b.z;
    		this.w = a.w - b.w;

    		return this;

    	}

    	/**
    	 * Multiplies the given vector with this instance.
    	 *
    	 * @param {Vector4} v - The vector to multiply.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	multiply( v ) {

    		this.x *= v.x;
    		this.y *= v.y;
    		this.z *= v.z;
    		this.w *= v.w;

    		return this;

    	}

    	/**
    	 * Multiplies the given scalar value with all components of this instance.
    	 *
    	 * @param {number} scalar - The scalar to multiply.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	multiplyScalar( scalar ) {

    		this.x *= scalar;
    		this.y *= scalar;
    		this.z *= scalar;
    		this.w *= scalar;

    		return this;

    	}

    	/**
    	 * Multiplies this vector with the given 4x4 matrix.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	applyMatrix4( m ) {

    		const x = this.x, y = this.y, z = this.z, w = this.w;
    		const e = m.elements;

    		this.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] * w;
    		this.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] * w;
    		this.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] * w;
    		this.w = e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] * w;

    		return this;

    	}

    	/**
    	 * Divides this instance by the given vector.
    	 *
    	 * @param {Vector4} v - The vector to divide.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	divide( v ) {

    		this.x /= v.x;
    		this.y /= v.y;
    		this.z /= v.z;
    		this.w /= v.w;

    		return this;

    	}

    	/**
    	 * Divides this vector by the given scalar.
    	 *
    	 * @param {number} scalar - The scalar to divide.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	divideScalar( scalar ) {

    		return this.multiplyScalar( 1 / scalar );

    	}

    	/**
    	 * Sets the x, y and z components of this
    	 * vector to the quaternion's axis and w to the angle.
    	 *
    	 * @param {Quaternion} q - The Quaternion to set.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setAxisAngleFromQuaternion( q ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToAngle/index.htm

    		// q is assumed to be normalized

    		this.w = 2 * Math.acos( q.w );

    		const s = Math.sqrt( 1 - q.w * q.w );

    		if ( s < 0.0001 ) {

    			this.x = 1;
    			this.y = 0;
    			this.z = 0;

    		} else {

    			this.x = q.x / s;
    			this.y = q.y / s;
    			this.z = q.z / s;

    		}

    		return this;

    	}

    	/**
    	 * Sets the x, y and z components of this
    	 * vector to the axis of rotation and w to the angle.
    	 *
    	 * @param {Matrix4} m - A 4x4 matrix of which the upper left 3x3 matrix is a pure rotation matrix.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setAxisAngleFromRotationMatrix( m ) {

    		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToAngle/index.htm

    		// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    		let angle, x, y, z; // variables for result
    		const epsilon = 0.01,		// margin to allow for rounding errors
    			epsilon2 = 0.1,		// margin to distinguish between 0 and 180 degrees

    			te = m.elements,

    			m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ],
    			m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ],
    			m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ];

    		if ( ( Math.abs( m12 - m21 ) < epsilon ) &&
    		     ( Math.abs( m13 - m31 ) < epsilon ) &&
    		     ( Math.abs( m23 - m32 ) < epsilon ) ) {

    			// singularity found
    			// first check for identity matrix which must have +1 for all terms
    			// in leading diagonal and zero in other terms

    			if ( ( Math.abs( m12 + m21 ) < epsilon2 ) &&
    			     ( Math.abs( m13 + m31 ) < epsilon2 ) &&
    			     ( Math.abs( m23 + m32 ) < epsilon2 ) &&
    			     ( Math.abs( m11 + m22 + m33 - 3 ) < epsilon2 ) ) {

    				// this singularity is identity matrix so angle = 0

    				this.set( 1, 0, 0, 0 );

    				return this; // zero angle, arbitrary axis

    			}

    			// otherwise this singularity is angle = 180

    			angle = Math.PI;

    			const xx = ( m11 + 1 ) / 2;
    			const yy = ( m22 + 1 ) / 2;
    			const zz = ( m33 + 1 ) / 2;
    			const xy = ( m12 + m21 ) / 4;
    			const xz = ( m13 + m31 ) / 4;
    			const yz = ( m23 + m32 ) / 4;

    			if ( ( xx > yy ) && ( xx > zz ) ) {

    				// m11 is the largest diagonal term

    				if ( xx < epsilon ) {

    					x = 0;
    					y = 0.707106781;
    					z = 0.707106781;

    				} else {

    					x = Math.sqrt( xx );
    					y = xy / x;
    					z = xz / x;

    				}

    			} else if ( yy > zz ) {

    				// m22 is the largest diagonal term

    				if ( yy < epsilon ) {

    					x = 0.707106781;
    					y = 0;
    					z = 0.707106781;

    				} else {

    					y = Math.sqrt( yy );
    					x = xy / y;
    					z = yz / y;

    				}

    			} else {

    				// m33 is the largest diagonal term so base result on this

    				if ( zz < epsilon ) {

    					x = 0.707106781;
    					y = 0.707106781;
    					z = 0;

    				} else {

    					z = Math.sqrt( zz );
    					x = xz / z;
    					y = yz / z;

    				}

    			}

    			this.set( x, y, z, angle );

    			return this; // return 180 deg rotation

    		}

    		// as we have reached here there are no singularities so we can handle normally

    		let s = Math.sqrt( ( m32 - m23 ) * ( m32 - m23 ) +
    			( m13 - m31 ) * ( m13 - m31 ) +
    			( m21 - m12 ) * ( m21 - m12 ) ); // used to normalize

    		if ( Math.abs( s ) < 0.001 ) s = 1;

    		// prevent divide by zero, should not happen if matrix is orthogonal and should be
    		// caught by singularity test above, but I've left it in just in case

    		this.x = ( m32 - m23 ) / s;
    		this.y = ( m13 - m31 ) / s;
    		this.z = ( m21 - m12 ) / s;
    		this.w = Math.acos( ( m11 + m22 + m33 - 1 ) / 2 );

    		return this;

    	}

    	/**
    	 * Sets the vector components to the position elements of the
    	 * given transformation matrix.
    	 *
    	 * @param {Matrix4} m - The 4x4 matrix.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setFromMatrixPosition( m ) {

    		const e = m.elements;

    		this.x = e[ 12 ];
    		this.y = e[ 13 ];
    		this.z = e[ 14 ];
    		this.w = e[ 15 ];

    		return this;

    	}

    	/**
    	 * If this vector's x, y, z or w value is greater than the given vector's x, y, z or w
    	 * value, replace that value with the corresponding min value.
    	 *
    	 * @param {Vector4} v - The vector.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	min( v ) {

    		this.x = Math.min( this.x, v.x );
    		this.y = Math.min( this.y, v.y );
    		this.z = Math.min( this.z, v.z );
    		this.w = Math.min( this.w, v.w );

    		return this;

    	}

    	/**
    	 * If this vector's x, y, z or w value is less than the given vector's x, y, z or w
    	 * value, replace that value with the corresponding max value.
    	 *
    	 * @param {Vector4} v - The vector.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	max( v ) {

    		this.x = Math.max( this.x, v.x );
    		this.y = Math.max( this.y, v.y );
    		this.z = Math.max( this.z, v.z );
    		this.w = Math.max( this.w, v.w );

    		return this;

    	}

    	/**
    	 * If this vector's x, y, z or w value is greater than the max vector's x, y, z or w
    	 * value, it is replaced by the corresponding value.
    	 * If this vector's x, y, z or w value is less than the min vector's x, y, z or w value,
    	 * it is replaced by the corresponding value.
    	 *
    	 * @param {Vector4} min - The minimum x, y and z values.
    	 * @param {Vector4} max - The maximum x, y and z values in the desired range.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	clamp( min, max ) {

    		// assumes min < max, componentwise

    		this.x = clamp( this.x, min.x, max.x );
    		this.y = clamp( this.y, min.y, max.y );
    		this.z = clamp( this.z, min.z, max.z );
    		this.w = clamp( this.w, min.w, max.w );

    		return this;

    	}

    	/**
    	 * If this vector's x, y, z or w values are greater than the max value, they are
    	 * replaced by the max value.
    	 * If this vector's x, y, z or w values are less than the min value, they are
    	 * replaced by the min value.
    	 *
    	 * @param {number} minVal - The minimum value the components will be clamped to.
    	 * @param {number} maxVal - The maximum value the components will be clamped to.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	clampScalar( minVal, maxVal ) {

    		this.x = clamp( this.x, minVal, maxVal );
    		this.y = clamp( this.y, minVal, maxVal );
    		this.z = clamp( this.z, minVal, maxVal );
    		this.w = clamp( this.w, minVal, maxVal );

    		return this;

    	}

    	/**
    	 * If this vector's length is greater than the max value, it is replaced by
    	 * the max value.
    	 * If this vector's length is less than the min value, it is replaced by the
    	 * min value.
    	 *
    	 * @param {number} min - The minimum value the vector length will be clamped to.
    	 * @param {number} max - The maximum value the vector length will be clamped to.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	clampLength( min, max ) {

    		const length = this.length();

    		return this.divideScalar( length || 1 ).multiplyScalar( clamp( length, min, max ) );

    	}

    	/**
    	 * The components of this vector are rounded down to the nearest integer value.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	floor() {

    		this.x = Math.floor( this.x );
    		this.y = Math.floor( this.y );
    		this.z = Math.floor( this.z );
    		this.w = Math.floor( this.w );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded up to the nearest integer value.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	ceil() {

    		this.x = Math.ceil( this.x );
    		this.y = Math.ceil( this.y );
    		this.z = Math.ceil( this.z );
    		this.w = Math.ceil( this.w );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded to the nearest integer value
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	round() {

    		this.x = Math.round( this.x );
    		this.y = Math.round( this.y );
    		this.z = Math.round( this.z );
    		this.w = Math.round( this.w );

    		return this;

    	}

    	/**
    	 * The components of this vector are rounded towards zero (up if negative,
    	 * down if positive) to an integer value.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	roundToZero() {

    		this.x = Math.trunc( this.x );
    		this.y = Math.trunc( this.y );
    		this.z = Math.trunc( this.z );
    		this.w = Math.trunc( this.w );

    		return this;

    	}

    	/**
    	 * Inverts this vector - i.e. sets x = -x, y = -y, z = -z, w = -w.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	negate() {

    		this.x = - this.x;
    		this.y = - this.y;
    		this.z = - this.z;
    		this.w = - this.w;

    		return this;

    	}

    	/**
    	 * Calculates the dot product of the given vector with this instance.
    	 *
    	 * @param {Vector4} v - The vector to compute the dot product with.
    	 * @return {number} The result of the dot product.
    	 */
    	dot( v ) {

    		return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;

    	}

    	/**
    	 * Computes the square of the Euclidean length (straight-line length) from
    	 * (0, 0, 0, 0) to (x, y, z, w). If you are comparing the lengths of vectors, you should
    	 * compare the length squared instead as it is slightly more efficient to calculate.
    	 *
    	 * @return {number} The square length of this vector.
    	 */
    	lengthSq() {

    		return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;

    	}

    	/**
    	 * Computes the  Euclidean length (straight-line length) from (0, 0, 0, 0) to (x, y, z, w).
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	length() {

    		return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w );

    	}

    	/**
    	 * Computes the Manhattan length of this vector.
    	 *
    	 * @return {number} The length of this vector.
    	 */
    	manhattanLength() {

    		return Math.abs( this.x ) + Math.abs( this.y ) + Math.abs( this.z ) + Math.abs( this.w );

    	}

    	/**
    	 * Converts this vector to a unit vector - that is, sets it equal to a vector
    	 * with the same direction as this one, but with a vector length of `1`.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	normalize() {

    		return this.divideScalar( this.length() || 1 );

    	}

    	/**
    	 * Sets this vector to a vector with the same direction as this one, but
    	 * with the specified length.
    	 *
    	 * @param {number} length - The new length of this vector.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	setLength( length ) {

    		return this.normalize().multiplyScalar( length );

    	}

    	/**
    	 * Linearly interpolates between the given vector and this instance, where
    	 * alpha is the percent distance along the line - alpha = 0 will be this
    	 * vector, and alpha = 1 will be the given one.
    	 *
    	 * @param {Vector4} v - The vector to interpolate towards.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	lerp( v, alpha ) {

    		this.x += ( v.x - this.x ) * alpha;
    		this.y += ( v.y - this.y ) * alpha;
    		this.z += ( v.z - this.z ) * alpha;
    		this.w += ( v.w - this.w ) * alpha;

    		return this;

    	}

    	/**
    	 * Linearly interpolates between the given vectors, where alpha is the percent
    	 * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
    	 * be the second one. The result is stored in this instance.
    	 *
    	 * @param {Vector4} v1 - The first vector.
    	 * @param {Vector4} v2 - The second vector.
    	 * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	lerpVectors( v1, v2, alpha ) {

    		this.x = v1.x + ( v2.x - v1.x ) * alpha;
    		this.y = v1.y + ( v2.y - v1.y ) * alpha;
    		this.z = v1.z + ( v2.z - v1.z ) * alpha;
    		this.w = v1.w + ( v2.w - v1.w ) * alpha;

    		return this;

    	}

    	/**
    	 * Returns `true` if this vector is equal with the given one.
    	 *
    	 * @param {Vector4} v - The vector to test for equality.
    	 * @return {boolean} Whether this vector is equal with the given one.
    	 */
    	equals( v ) {

    		return ( ( v.x === this.x ) && ( v.y === this.y ) && ( v.z === this.z ) && ( v.w === this.w ) );

    	}

    	/**
    	 * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`,
    	 * z value to be `array[ offset + 2 ]`, w value to be `array[ offset + 3 ]`.
    	 *
    	 * @param {Array<number>} array - An array holding the vector component values.
    	 * @param {number} [offset=0] - The offset into the array.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	fromArray( array, offset = 0 ) {

    		this.x = array[ offset ];
    		this.y = array[ offset + 1 ];
    		this.z = array[ offset + 2 ];
    		this.w = array[ offset + 3 ];

    		return this;

    	}

    	/**
    	 * Writes the components of this vector to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the vector components.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The vector components.
    	 */
    	toArray( array = [], offset = 0 ) {

    		array[ offset ] = this.x;
    		array[ offset + 1 ] = this.y;
    		array[ offset + 2 ] = this.z;
    		array[ offset + 3 ] = this.w;

    		return array;

    	}

    	/**
    	 * Sets the components of this vector from the given buffer attribute.
    	 *
    	 * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
    	 * @param {number} index - The index into the attribute.
    	 * @return {Vector4} A reference to this vector.
    	 */
    	fromBufferAttribute( attribute, index ) {

    		this.x = attribute.getX( index );
    		this.y = attribute.getY( index );
    		this.z = attribute.getZ( index );
    		this.w = attribute.getW( index );

    		return this;

    	}

    	/**
    	 * Sets each component of this vector to a pseudo-random value between `0` and
    	 * `1`, excluding `1`.
    	 *
    	 * @return {Vector4} A reference to this vector.
    	 */
    	random() {

    		this.x = Math.random();
    		this.y = Math.random();
    		this.z = Math.random();
    		this.w = Math.random();

    		return this;

    	}

    	*[ Symbol.iterator ]() {

    		yield this.x;
    		yield this.y;
    		yield this.z;
    		yield this.w;

    	}

    }

    /**
     * Represents a 4x4 matrix.
     *
     * The most common use of a 4x4 matrix in 3D computer graphics is as a transformation matrix.
     * For an introduction to transformation matrices as used in WebGL, check out [this tutorial](https://www.opengl-tutorial.org/beginners-tutorials/tutorial-3-matrices)
     *
     * This allows a 3D vector representing a point in 3D space to undergo
     * transformations such as translation, rotation, shear, scale, reflection,
     * orthogonal or perspective projection and so on, by being multiplied by the
     * matrix. This is known as `applying` the matrix to the vector.
     *
     * A Note on Row-Major and Column-Major Ordering:
     *
     * The constructor and {@link Matrix3#set} method take arguments in
     * [row-major](https://en.wikipedia.org/wiki/Row-_and_column-major_order#Column-major_order)
     * order, while internally they are stored in the {@link Matrix3#elements} array in column-major order.
     * This means that calling:
     * ```js
     * const m = new THREE.Matrix4();
     * m.set( 11, 12, 13, 14,
     *        21, 22, 23, 24,
     *        31, 32, 33, 34,
     *        41, 42, 43, 44 );
     * ```
     * will result in the elements array containing:
     * ```js
     * m.elements = [ 11, 21, 31, 41,
     *                12, 22, 32, 42,
     *                13, 23, 33, 43,
     *                14, 24, 34, 44 ];
     * ```
     * and internally all calculations are performed using column-major ordering.
     * However, as the actual ordering makes no difference mathematically and
     * most people are used to thinking about matrices in row-major order, the
     * three.js documentation shows matrices in row-major order. Just bear in
     * mind that if you are reading the source code, you'll have to take the
     * transpose of any matrices outlined here to make sense of the calculations.
     */
    class Matrix4 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Matrix4.prototype.isMatrix4 = true;

    	}

    	/**
    	 * Constructs a new 4x4 matrix. The arguments are supposed to be
    	 * in row-major order. If no arguments are provided, the constructor
    	 * initializes the matrix as an identity matrix.
    	 *
    	 * @param {number} [n11] - 1-1 matrix element.
    	 * @param {number} [n12] - 1-2 matrix element.
    	 * @param {number} [n13] - 1-3 matrix element.
    	 * @param {number} [n14] - 1-4 matrix element.
    	 * @param {number} [n21] - 2-1 matrix element.
    	 * @param {number} [n22] - 2-2 matrix element.
    	 * @param {number} [n23] - 2-3 matrix element.
    	 * @param {number} [n24] - 2-4 matrix element.
    	 * @param {number} [n31] - 3-1 matrix element.
    	 * @param {number} [n32] - 3-2 matrix element.
    	 * @param {number} [n33] - 3-3 matrix element.
    	 * @param {number} [n34] - 3-4 matrix element.
    	 * @param {number} [n41] - 4-1 matrix element.
    	 * @param {number} [n42] - 4-2 matrix element.
    	 * @param {number} [n43] - 4-3 matrix element.
    	 * @param {number} [n44] - 4-4 matrix element.
    	 */
    	constructor( n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44 ) {

    		/**
    		 * A column-major list of matrix values.
    		 *
    		 * @type {Array<number>}
    		 */
    		this.elements = [

    			1, 0, 0, 0,
    			0, 1, 0, 0,
    			0, 0, 1, 0,
    			0, 0, 0, 1

    		];

    		if ( n11 !== undefined ) {

    			this.set( n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44 );

    		}

    	}

    	/**
    	 * Sets the elements of the matrix.The arguments are supposed to be
    	 * in row-major order.
    	 *
    	 * @param {number} [n11] - 1-1 matrix element.
    	 * @param {number} [n12] - 1-2 matrix element.
    	 * @param {number} [n13] - 1-3 matrix element.
    	 * @param {number} [n14] - 1-4 matrix element.
    	 * @param {number} [n21] - 2-1 matrix element.
    	 * @param {number} [n22] - 2-2 matrix element.
    	 * @param {number} [n23] - 2-3 matrix element.
    	 * @param {number} [n24] - 2-4 matrix element.
    	 * @param {number} [n31] - 3-1 matrix element.
    	 * @param {number} [n32] - 3-2 matrix element.
    	 * @param {number} [n33] - 3-3 matrix element.
    	 * @param {number} [n34] - 3-4 matrix element.
    	 * @param {number} [n41] - 4-1 matrix element.
    	 * @param {number} [n42] - 4-2 matrix element.
    	 * @param {number} [n43] - 4-3 matrix element.
    	 * @param {number} [n44] - 4-4 matrix element.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	set( n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44 ) {

    		const te = this.elements;

    		te[ 0 ] = n11; te[ 4 ] = n12; te[ 8 ] = n13; te[ 12 ] = n14;
    		te[ 1 ] = n21; te[ 5 ] = n22; te[ 9 ] = n23; te[ 13 ] = n24;
    		te[ 2 ] = n31; te[ 6 ] = n32; te[ 10 ] = n33; te[ 14 ] = n34;
    		te[ 3 ] = n41; te[ 7 ] = n42; te[ 11 ] = n43; te[ 15 ] = n44;

    		return this;

    	}

    	/**
    	 * Sets this matrix to the 4x4 identity matrix.
    	 *
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	identity() {

    		this.set(

    			1, 0, 0, 0,
    			0, 1, 0, 0,
    			0, 0, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Returns a matrix with copied values from this instance.
    	 *
    	 * @return {Matrix4} A clone of this instance.
    	 */
    	clone() {

    		return new Matrix4().fromArray( this.elements );

    	}

    	/**
    	 * Copies the values of the given matrix to this instance.
    	 *
    	 * @param {Matrix4} m - The matrix to copy.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	copy( m ) {

    		const te = this.elements;
    		const me = m.elements;

    		te[ 0 ] = me[ 0 ]; te[ 1 ] = me[ 1 ]; te[ 2 ] = me[ 2 ]; te[ 3 ] = me[ 3 ];
    		te[ 4 ] = me[ 4 ]; te[ 5 ] = me[ 5 ]; te[ 6 ] = me[ 6 ]; te[ 7 ] = me[ 7 ];
    		te[ 8 ] = me[ 8 ]; te[ 9 ] = me[ 9 ]; te[ 10 ] = me[ 10 ]; te[ 11 ] = me[ 11 ];
    		te[ 12 ] = me[ 12 ]; te[ 13 ] = me[ 13 ]; te[ 14 ] = me[ 14 ]; te[ 15 ] = me[ 15 ];

    		return this;

    	}

    	/**
    	 * Copies the translation component of the given matrix
    	 * into this matrix's translation component.
    	 *
    	 * @param {Matrix4} m - The matrix to copy the translation component.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	copyPosition( m ) {

    		const te = this.elements, me = m.elements;

    		te[ 12 ] = me[ 12 ];
    		te[ 13 ] = me[ 13 ];
    		te[ 14 ] = me[ 14 ];

    		return this;

    	}

    	/**
    	 * Set the upper 3x3 elements of this matrix to the values of given 3x3 matrix.
    	 *
    	 * @param {Matrix3} m - The 3x3 matrix.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	setFromMatrix3( m ) {

    		const me = m.elements;

    		this.set(

    			me[ 0 ], me[ 3 ], me[ 6 ], 0,
    			me[ 1 ], me[ 4 ], me[ 7 ], 0,
    			me[ 2 ], me[ 5 ], me[ 8 ], 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Extracts the basis of this matrix into the three axis vectors provided.
    	 *
    	 * @param {Vector3} xAxis - The basis's x axis.
    	 * @param {Vector3} yAxis - The basis's y axis.
    	 * @param {Vector3} zAxis - The basis's z axis.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	extractBasis( xAxis, yAxis, zAxis ) {

    		if ( this.determinant() === 0 ) {

    			xAxis.set( 1, 0, 0 );
    			yAxis.set( 0, 1, 0 );
    			zAxis.set( 0, 0, 1 );

    			return this;

    		}

    		xAxis.setFromMatrixColumn( this, 0 );
    		yAxis.setFromMatrixColumn( this, 1 );
    		zAxis.setFromMatrixColumn( this, 2 );

    		return this;

    	}

    	/**
    	 * Sets the given basis vectors to this matrix.
    	 *
    	 * @param {Vector3} xAxis - The basis's x axis.
    	 * @param {Vector3} yAxis - The basis's y axis.
    	 * @param {Vector3} zAxis - The basis's z axis.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeBasis( xAxis, yAxis, zAxis ) {

    		this.set(
    			xAxis.x, yAxis.x, zAxis.x, 0,
    			xAxis.y, yAxis.y, zAxis.y, 0,
    			xAxis.z, yAxis.z, zAxis.z, 0,
    			0, 0, 0, 1
    		);

    		return this;

    	}

    	/**
    	 * Extracts the rotation component of the given matrix
    	 * into this matrix's rotation component.
    	 *
    	 * Note: This method does not support reflection matrices.
    	 *
    	 * @param {Matrix4} m - The matrix.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	extractRotation( m ) {

    		if ( m.determinant() === 0 ) {

    			return this.identity();

    		}

    		const te = this.elements;
    		const me = m.elements;

    		const scaleX = 1 / _v1$7.setFromMatrixColumn( m, 0 ).length();
    		const scaleY = 1 / _v1$7.setFromMatrixColumn( m, 1 ).length();
    		const scaleZ = 1 / _v1$7.setFromMatrixColumn( m, 2 ).length();

    		te[ 0 ] = me[ 0 ] * scaleX;
    		te[ 1 ] = me[ 1 ] * scaleX;
    		te[ 2 ] = me[ 2 ] * scaleX;
    		te[ 3 ] = 0;

    		te[ 4 ] = me[ 4 ] * scaleY;
    		te[ 5 ] = me[ 5 ] * scaleY;
    		te[ 6 ] = me[ 6 ] * scaleY;
    		te[ 7 ] = 0;

    		te[ 8 ] = me[ 8 ] * scaleZ;
    		te[ 9 ] = me[ 9 ] * scaleZ;
    		te[ 10 ] = me[ 10 ] * scaleZ;
    		te[ 11 ] = 0;

    		te[ 12 ] = 0;
    		te[ 13 ] = 0;
    		te[ 14 ] = 0;
    		te[ 15 ] = 1;

    		return this;

    	}

    	/**
    	 * Sets the rotation component (the upper left 3x3 matrix) of this matrix to
    	 * the rotation specified by the given Euler angles. The rest of
    	 * the matrix is set to the identity. Depending on the {@link Euler#order},
    	 * there are six possible outcomes. See [this page](https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix)
    	 * for a complete list.
    	 *
    	 * @param {Euler} euler - The Euler angles.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationFromEuler( euler ) {

    		const te = this.elements;

    		const x = euler.x, y = euler.y, z = euler.z;
    		const a = Math.cos( x ), b = Math.sin( x );
    		const c = Math.cos( y ), d = Math.sin( y );
    		const e = Math.cos( z ), f = Math.sin( z );

    		if ( euler.order === 'XYZ' ) {

    			const ae = a * e, af = a * f, be = b * e, bf = b * f;

    			te[ 0 ] = c * e;
    			te[ 4 ] = - c * f;
    			te[ 8 ] = d;

    			te[ 1 ] = af + be * d;
    			te[ 5 ] = ae - bf * d;
    			te[ 9 ] = - b * c;

    			te[ 2 ] = bf - ae * d;
    			te[ 6 ] = be + af * d;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'YXZ' ) {

    			const ce = c * e, cf = c * f, de = d * e, df = d * f;

    			te[ 0 ] = ce + df * b;
    			te[ 4 ] = de * b - cf;
    			te[ 8 ] = a * d;

    			te[ 1 ] = a * f;
    			te[ 5 ] = a * e;
    			te[ 9 ] = - b;

    			te[ 2 ] = cf * b - de;
    			te[ 6 ] = df + ce * b;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'ZXY' ) {

    			const ce = c * e, cf = c * f, de = d * e, df = d * f;

    			te[ 0 ] = ce - df * b;
    			te[ 4 ] = - a * f;
    			te[ 8 ] = de + cf * b;

    			te[ 1 ] = cf + de * b;
    			te[ 5 ] = a * e;
    			te[ 9 ] = df - ce * b;

    			te[ 2 ] = - a * d;
    			te[ 6 ] = b;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'ZYX' ) {

    			const ae = a * e, af = a * f, be = b * e, bf = b * f;

    			te[ 0 ] = c * e;
    			te[ 4 ] = be * d - af;
    			te[ 8 ] = ae * d + bf;

    			te[ 1 ] = c * f;
    			te[ 5 ] = bf * d + ae;
    			te[ 9 ] = af * d - be;

    			te[ 2 ] = - d;
    			te[ 6 ] = b * c;
    			te[ 10 ] = a * c;

    		} else if ( euler.order === 'YZX' ) {

    			const ac = a * c, ad = a * d, bc = b * c, bd = b * d;

    			te[ 0 ] = c * e;
    			te[ 4 ] = bd - ac * f;
    			te[ 8 ] = bc * f + ad;

    			te[ 1 ] = f;
    			te[ 5 ] = a * e;
    			te[ 9 ] = - b * e;

    			te[ 2 ] = - d * e;
    			te[ 6 ] = ad * f + bc;
    			te[ 10 ] = ac - bd * f;

    		} else if ( euler.order === 'XZY' ) {

    			const ac = a * c, ad = a * d, bc = b * c, bd = b * d;

    			te[ 0 ] = c * e;
    			te[ 4 ] = - f;
    			te[ 8 ] = d * e;

    			te[ 1 ] = ac * f + bd;
    			te[ 5 ] = a * e;
    			te[ 9 ] = ad * f - bc;

    			te[ 2 ] = bc * f - ad;
    			te[ 6 ] = b * e;
    			te[ 10 ] = bd * f + ac;

    		}

    		// bottom row
    		te[ 3 ] = 0;
    		te[ 7 ] = 0;
    		te[ 11 ] = 0;

    		// last column
    		te[ 12 ] = 0;
    		te[ 13 ] = 0;
    		te[ 14 ] = 0;
    		te[ 15 ] = 1;

    		return this;

    	}

    	/**
    	 * Sets the rotation component of this matrix to the rotation specified by
    	 * the given Quaternion as outlined [here](https://en.wikipedia.org/wiki/Rotation_matrix#Quaternion)
    	 * The rest of the matrix is set to the identity.
    	 *
    	 * @param {Quaternion} q - The Quaternion.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationFromQuaternion( q ) {

    		return this.compose( _zero, q, _one );

    	}

    	/**
    	 * Sets the rotation component of the transformation matrix, looking from `eye` towards
    	 * `target`, and oriented by the up-direction.
    	 *
    	 * @param {Vector3} eye - The eye vector.
    	 * @param {Vector3} target - The target vector.
    	 * @param {Vector3} up - The up vector.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	lookAt( eye, target, up ) {

    		const te = this.elements;

    		_z.subVectors( eye, target );

    		if ( _z.lengthSq() === 0 ) {

    			// eye and target are in the same position

    			_z.z = 1;

    		}

    		_z.normalize();
    		_x.crossVectors( up, _z );

    		if ( _x.lengthSq() === 0 ) {

    			// up and z are parallel

    			if ( Math.abs( up.z ) === 1 ) {

    				_z.x += 0.0001;

    			} else {

    				_z.z += 0.0001;

    			}

    			_z.normalize();
    			_x.crossVectors( up, _z );

    		}

    		_x.normalize();
    		_y.crossVectors( _z, _x );

    		te[ 0 ] = _x.x; te[ 4 ] = _y.x; te[ 8 ] = _z.x;
    		te[ 1 ] = _x.y; te[ 5 ] = _y.y; te[ 9 ] = _z.y;
    		te[ 2 ] = _x.z; te[ 6 ] = _y.z; te[ 10 ] = _z.z;

    		return this;

    	}

    	/**
    	 * Post-multiplies this matrix by the given 4x4 matrix.
    	 *
    	 * @param {Matrix4} m - The matrix to multiply with.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	multiply( m ) {

    		return this.multiplyMatrices( this, m );

    	}

    	/**
    	 * Pre-multiplies this matrix by the given 4x4 matrix.
    	 *
    	 * @param {Matrix4} m - The matrix to multiply with.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	premultiply( m ) {

    		return this.multiplyMatrices( m, this );

    	}

    	/**
    	 * Multiples the given 4x4 matrices and stores the result
    	 * in this matrix.
    	 *
    	 * @param {Matrix4} a - The first matrix.
    	 * @param {Matrix4} b - The second matrix.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	multiplyMatrices( a, b ) {

    		const ae = a.elements;
    		const be = b.elements;
    		const te = this.elements;

    		const a11 = ae[ 0 ], a12 = ae[ 4 ], a13 = ae[ 8 ], a14 = ae[ 12 ];
    		const a21 = ae[ 1 ], a22 = ae[ 5 ], a23 = ae[ 9 ], a24 = ae[ 13 ];
    		const a31 = ae[ 2 ], a32 = ae[ 6 ], a33 = ae[ 10 ], a34 = ae[ 14 ];
    		const a41 = ae[ 3 ], a42 = ae[ 7 ], a43 = ae[ 11 ], a44 = ae[ 15 ];

    		const b11 = be[ 0 ], b12 = be[ 4 ], b13 = be[ 8 ], b14 = be[ 12 ];
    		const b21 = be[ 1 ], b22 = be[ 5 ], b23 = be[ 9 ], b24 = be[ 13 ];
    		const b31 = be[ 2 ], b32 = be[ 6 ], b33 = be[ 10 ], b34 = be[ 14 ];
    		const b41 = be[ 3 ], b42 = be[ 7 ], b43 = be[ 11 ], b44 = be[ 15 ];

    		te[ 0 ] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    		te[ 4 ] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    		te[ 8 ] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    		te[ 12 ] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    		te[ 1 ] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    		te[ 5 ] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    		te[ 9 ] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    		te[ 13 ] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    		te[ 2 ] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    		te[ 6 ] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    		te[ 10 ] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    		te[ 14 ] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    		te[ 3 ] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    		te[ 7 ] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    		te[ 11 ] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    		te[ 15 ] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    		return this;

    	}

    	/**
    	 * Multiplies every component of the matrix by the given scalar.
    	 *
    	 * @param {number} s - The scalar.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	multiplyScalar( s ) {

    		const te = this.elements;

    		te[ 0 ] *= s; te[ 4 ] *= s; te[ 8 ] *= s; te[ 12 ] *= s;
    		te[ 1 ] *= s; te[ 5 ] *= s; te[ 9 ] *= s; te[ 13 ] *= s;
    		te[ 2 ] *= s; te[ 6 ] *= s; te[ 10 ] *= s; te[ 14 ] *= s;
    		te[ 3 ] *= s; te[ 7 ] *= s; te[ 11 ] *= s; te[ 15 ] *= s;

    		return this;

    	}

    	/**
    	 * Computes and returns the determinant of this matrix.
    	 *
    	 * Based on the method outlined [here](http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.html).
    	 *
    	 * @return {number} The determinant.
    	 */
    	determinant() {

    		const te = this.elements;

    		const n11 = te[ 0 ], n12 = te[ 4 ], n13 = te[ 8 ], n14 = te[ 12 ];
    		const n21 = te[ 1 ], n22 = te[ 5 ], n23 = te[ 9 ], n24 = te[ 13 ];
    		const n31 = te[ 2 ], n32 = te[ 6 ], n33 = te[ 10 ], n34 = te[ 14 ];
    		const n41 = te[ 3 ], n42 = te[ 7 ], n43 = te[ 11 ], n44 = te[ 15 ];

    		const t11 = n23 * n34 - n24 * n33;
    		const t12 = n22 * n34 - n24 * n32;
    		const t13 = n22 * n33 - n23 * n32;

    		const t21 = n21 * n34 - n24 * n31;
    		const t22 = n21 * n33 - n23 * n31;
    		const t23 = n21 * n32 - n22 * n31;

    		return n11 * ( n42 * t11 - n43 * t12 + n44 * t13 ) -
    			n12 * ( n41 * t11 - n43 * t21 + n44 * t22 ) +
    			n13 * ( n41 * t12 - n42 * t21 + n44 * t23 ) -
    			n14 * ( n41 * t13 - n42 * t22 + n43 * t23 );

    	}

    	/**
    	 * Transposes this matrix in place.
    	 *
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	transpose() {

    		const te = this.elements;
    		let tmp;

    		tmp = te[ 1 ]; te[ 1 ] = te[ 4 ]; te[ 4 ] = tmp;
    		tmp = te[ 2 ]; te[ 2 ] = te[ 8 ]; te[ 8 ] = tmp;
    		tmp = te[ 6 ]; te[ 6 ] = te[ 9 ]; te[ 9 ] = tmp;

    		tmp = te[ 3 ]; te[ 3 ] = te[ 12 ]; te[ 12 ] = tmp;
    		tmp = te[ 7 ]; te[ 7 ] = te[ 13 ]; te[ 13 ] = tmp;
    		tmp = te[ 11 ]; te[ 11 ] = te[ 14 ]; te[ 14 ] = tmp;

    		return this;

    	}

    	/**
    	 * Sets the position component for this matrix from the given vector,
    	 * without affecting the rest of the matrix.
    	 *
    	 * @param {number|Vector3} x - The x component of the vector or alternatively the vector object.
    	 * @param {number} y - The y component of the vector.
    	 * @param {number} z - The z component of the vector.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	setPosition( x, y, z ) {

    		const te = this.elements;

    		if ( x.isVector3 ) {

    			te[ 12 ] = x.x;
    			te[ 13 ] = x.y;
    			te[ 14 ] = x.z;

    		} else {

    			te[ 12 ] = x;
    			te[ 13 ] = y;
    			te[ 14 ] = z;

    		}

    		return this;

    	}

    	/**
    	 * Inverts this matrix, using the [analytic method](https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution).
    	 * You can not invert with a determinant of zero. If you attempt this, the method produces
    	 * a zero matrix instead.
    	 *
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	invert() {

    		// based on https://github.com/toji/gl-matrix
    		const te = this.elements,

    			n11 = te[ 0 ], n21 = te[ 1 ], n31 = te[ 2 ], n41 = te[ 3 ],
    			n12 = te[ 4 ], n22 = te[ 5 ], n32 = te[ 6 ], n42 = te[ 7 ],
    			n13 = te[ 8 ], n23 = te[ 9 ], n33 = te[ 10 ], n43 = te[ 11 ],
    			n14 = te[ 12 ], n24 = te[ 13 ], n34 = te[ 14 ], n44 = te[ 15 ],

    			t1 = n11 * n22 - n21 * n12,
    			t2 = n11 * n32 - n31 * n12,
    			t3 = n11 * n42 - n41 * n12,
    			t4 = n21 * n32 - n31 * n22,
    			t5 = n21 * n42 - n41 * n22,
    			t6 = n31 * n42 - n41 * n32,
    			t7 = n13 * n24 - n23 * n14,
    			t8 = n13 * n34 - n33 * n14,
    			t9 = n13 * n44 - n43 * n14,
    			t10 = n23 * n34 - n33 * n24,
    			t11 = n23 * n44 - n43 * n24,
    			t12 = n33 * n44 - n43 * n34;

    		const det = t1 * t12 - t2 * t11 + t3 * t10 + t4 * t9 - t5 * t8 + t6 * t7;

    		if ( det === 0 ) return this.set( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 );

    		const detInv = 1 / det;

    		te[ 0 ] = ( n22 * t12 - n32 * t11 + n42 * t10 ) * detInv;
    		te[ 1 ] = ( n31 * t11 - n21 * t12 - n41 * t10 ) * detInv;
    		te[ 2 ] = ( n24 * t6 - n34 * t5 + n44 * t4 ) * detInv;
    		te[ 3 ] = ( n33 * t5 - n23 * t6 - n43 * t4 ) * detInv;

    		te[ 4 ] = ( n32 * t9 - n12 * t12 - n42 * t8 ) * detInv;
    		te[ 5 ] = ( n11 * t12 - n31 * t9 + n41 * t8 ) * detInv;
    		te[ 6 ] = ( n34 * t3 - n14 * t6 - n44 * t2 ) * detInv;
    		te[ 7 ] = ( n13 * t6 - n33 * t3 + n43 * t2 ) * detInv;

    		te[ 8 ] = ( n12 * t11 - n22 * t9 + n42 * t7 ) * detInv;
    		te[ 9 ] = ( n21 * t9 - n11 * t11 - n41 * t7 ) * detInv;
    		te[ 10 ] = ( n14 * t5 - n24 * t3 + n44 * t1 ) * detInv;
    		te[ 11 ] = ( n23 * t3 - n13 * t5 - n43 * t1 ) * detInv;

    		te[ 12 ] = ( n22 * t8 - n12 * t10 - n32 * t7 ) * detInv;
    		te[ 13 ] = ( n11 * t10 - n21 * t8 + n31 * t7 ) * detInv;
    		te[ 14 ] = ( n24 * t2 - n14 * t4 - n34 * t1 ) * detInv;
    		te[ 15 ] = ( n13 * t4 - n23 * t2 + n33 * t1 ) * detInv;

    		return this;

    	}

    	/**
    	 * Multiplies the columns of this matrix by the given vector.
    	 *
    	 * @param {Vector3} v - The scale vector.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	scale( v ) {

    		const te = this.elements;
    		const x = v.x, y = v.y, z = v.z;

    		te[ 0 ] *= x; te[ 4 ] *= y; te[ 8 ] *= z;
    		te[ 1 ] *= x; te[ 5 ] *= y; te[ 9 ] *= z;
    		te[ 2 ] *= x; te[ 6 ] *= y; te[ 10 ] *= z;
    		te[ 3 ] *= x; te[ 7 ] *= y; te[ 11 ] *= z;

    		return this;

    	}

    	/**
    	 * Gets the maximum scale value of the three axes.
    	 *
    	 * @return {number} The maximum scale.
    	 */
    	getMaxScaleOnAxis() {

    		const te = this.elements;

    		const scaleXSq = te[ 0 ] * te[ 0 ] + te[ 1 ] * te[ 1 ] + te[ 2 ] * te[ 2 ];
    		const scaleYSq = te[ 4 ] * te[ 4 ] + te[ 5 ] * te[ 5 ] + te[ 6 ] * te[ 6 ];
    		const scaleZSq = te[ 8 ] * te[ 8 ] + te[ 9 ] * te[ 9 ] + te[ 10 ] * te[ 10 ];

    		return Math.sqrt( Math.max( scaleXSq, scaleYSq, scaleZSq ) );

    	}

    	/**
    	 * Sets this matrix as a translation transform from the given vector.
    	 *
    	 * @param {number|Vector3} x - The amount to translate in the X axis or alternatively a translation vector.
    	 * @param {number} y - The amount to translate in the Y axis.
    	 * @param {number} z - The amount to translate in the z axis.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeTranslation( x, y, z ) {

    		if ( x.isVector3 ) {

    			this.set(

    				1, 0, 0, x.x,
    				0, 1, 0, x.y,
    				0, 0, 1, x.z,
    				0, 0, 0, 1

    			);

    		} else {

    			this.set(

    				1, 0, 0, x,
    				0, 1, 0, y,
    				0, 0, 1, z,
    				0, 0, 0, 1

    			);

    		}

    		return this;

    	}

    	/**
    	 * Sets this matrix as a rotational transformation around the X axis by
    	 * the given angle.
    	 *
    	 * @param {number} theta - The rotation in radians.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationX( theta ) {

    		const c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			1, 0, 0, 0,
    			0, c, - s, 0,
    			0, s, c, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a rotational transformation around the Y axis by
    	 * the given angle.
    	 *
    	 * @param {number} theta - The rotation in radians.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationY( theta ) {

    		const c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			 c, 0, s, 0,
    			 0, 1, 0, 0,
    			- s, 0, c, 0,
    			 0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a rotational transformation around the Z axis by
    	 * the given angle.
    	 *
    	 * @param {number} theta - The rotation in radians.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationZ( theta ) {

    		const c = Math.cos( theta ), s = Math.sin( theta );

    		this.set(

    			c, - s, 0, 0,
    			s, c, 0, 0,
    			0, 0, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a rotational transformation around the given axis by
    	 * the given angle.
    	 *
    	 * This is a somewhat controversial but mathematically sound alternative to
    	 * rotating via Quaternions. See the discussion [here](https://www.gamedev.net/articles/programming/math-and-physics/do-we-really-need-quaternions-r1199).
    	 *
    	 * @param {Vector3} axis - The normalized rotation axis.
    	 * @param {number} angle - The rotation in radians.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeRotationAxis( axis, angle ) {

    		// Based on http://www.gamedev.net/reference/articles/article1199.asp

    		const c = Math.cos( angle );
    		const s = Math.sin( angle );
    		const t = 1 - c;
    		const x = axis.x, y = axis.y, z = axis.z;
    		const tx = t * x, ty = t * y;

    		this.set(

    			tx * x + c, tx * y - s * z, tx * z + s * y, 0,
    			tx * y + s * z, ty * y + c, ty * z - s * x, 0,
    			tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a scale transformation.
    	 *
    	 * @param {number} x - The amount to scale in the X axis.
    	 * @param {number} y - The amount to scale in the Y axis.
    	 * @param {number} z - The amount to scale in the Z axis.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeScale( x, y, z ) {

    		this.set(

    			x, 0, 0, 0,
    			0, y, 0, 0,
    			0, 0, z, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix as a shear transformation.
    	 *
    	 * @param {number} xy - The amount to shear X by Y.
    	 * @param {number} xz - The amount to shear X by Z.
    	 * @param {number} yx - The amount to shear Y by X.
    	 * @param {number} yz - The amount to shear Y by Z.
    	 * @param {number} zx - The amount to shear Z by X.
    	 * @param {number} zy - The amount to shear Z by Y.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeShear( xy, xz, yx, yz, zx, zy ) {

    		this.set(

    			1, yx, zx, 0,
    			xy, 1, zy, 0,
    			xz, yz, 1, 0,
    			0, 0, 0, 1

    		);

    		return this;

    	}

    	/**
    	 * Sets this matrix to the transformation composed of the given position,
    	 * rotation (Quaternion) and scale.
    	 *
    	 * @param {Vector3} position - The position vector.
    	 * @param {Quaternion} quaternion - The rotation as a Quaternion.
    	 * @param {Vector3} scale - The scale vector.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	compose( position, quaternion, scale ) {

    		const te = this.elements;

    		const x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w;
    		const x2 = x + x,	y2 = y + y, z2 = z + z;
    		const xx = x * x2, xy = x * y2, xz = x * z2;
    		const yy = y * y2, yz = y * z2, zz = z * z2;
    		const wx = w * x2, wy = w * y2, wz = w * z2;

    		const sx = scale.x, sy = scale.y, sz = scale.z;

    		te[ 0 ] = ( 1 - ( yy + zz ) ) * sx;
    		te[ 1 ] = ( xy + wz ) * sx;
    		te[ 2 ] = ( xz - wy ) * sx;
    		te[ 3 ] = 0;

    		te[ 4 ] = ( xy - wz ) * sy;
    		te[ 5 ] = ( 1 - ( xx + zz ) ) * sy;
    		te[ 6 ] = ( yz + wx ) * sy;
    		te[ 7 ] = 0;

    		te[ 8 ] = ( xz + wy ) * sz;
    		te[ 9 ] = ( yz - wx ) * sz;
    		te[ 10 ] = ( 1 - ( xx + yy ) ) * sz;
    		te[ 11 ] = 0;

    		te[ 12 ] = position.x;
    		te[ 13 ] = position.y;
    		te[ 14 ] = position.z;
    		te[ 15 ] = 1;

    		return this;

    	}

    	/**
    	 * Decomposes this matrix into its position, rotation and scale components
    	 * and provides the result in the given objects.
    	 *
    	 * Note: Not all matrices are decomposable in this way. For example, if an
    	 * object has a non-uniformly scaled parent, then the object's world matrix
    	 * may not be decomposable, and this method may not be appropriate.
    	 *
    	 * @param {Vector3} position - The position vector.
    	 * @param {Quaternion} quaternion - The rotation as a Quaternion.
    	 * @param {Vector3} scale - The scale vector.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	decompose( position, quaternion, scale ) {

    		const te = this.elements;

    		position.x = te[ 12 ];
    		position.y = te[ 13 ];
    		position.z = te[ 14 ];

    		const det = this.determinant();

    		if ( det === 0 ) {

    			scale.set( 1, 1, 1 );
    			quaternion.identity();

    			return this;

    		}

    		let sx = _v1$7.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
    		const sy = _v1$7.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
    		const sz = _v1$7.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();

    		// if determinant is negative, we need to invert one scale
    		if ( det < 0 ) sx = - sx;

    		// scale the rotation part
    		_m1$2.copy( this );

    		const invSX = 1 / sx;
    		const invSY = 1 / sy;
    		const invSZ = 1 / sz;

    		_m1$2.elements[ 0 ] *= invSX;
    		_m1$2.elements[ 1 ] *= invSX;
    		_m1$2.elements[ 2 ] *= invSX;

    		_m1$2.elements[ 4 ] *= invSY;
    		_m1$2.elements[ 5 ] *= invSY;
    		_m1$2.elements[ 6 ] *= invSY;

    		_m1$2.elements[ 8 ] *= invSZ;
    		_m1$2.elements[ 9 ] *= invSZ;
    		_m1$2.elements[ 10 ] *= invSZ;

    		quaternion.setFromRotationMatrix( _m1$2 );

    		scale.x = sx;
    		scale.y = sy;
    		scale.z = sz;

    		return this;

    	}

    	/**
    	 * Creates a perspective projection matrix. This is used internally by
    	 * {@link PerspectiveCamera#updateProjectionMatrix}.

    	 * @param {number} left - Left boundary of the viewing frustum at the near plane.
    	 * @param {number} right - Right boundary of the viewing frustum at the near plane.
    	 * @param {number} top - Top boundary of the viewing frustum at the near plane.
    	 * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
    	 * @param {number} near - The distance from the camera to the near plane.
    	 * @param {number} far - The distance from the camera to the far plane.
    	 * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
    	 * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makePerspective( left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false ) {

    		const te = this.elements;

    		const x = 2 * near / ( right - left );
    		const y = 2 * near / ( top - bottom );

    		const a = ( right + left ) / ( right - left );
    		const b = ( top + bottom ) / ( top - bottom );

    		let c, d;

    		if ( reversedDepth ) {

    			c = near / ( far - near );
    			d = ( far * near ) / ( far - near );

    		} else {

    			if ( coordinateSystem === WebGLCoordinateSystem ) {

    				c = - ( far + near ) / ( far - near );
    				d = ( -2 * far * near ) / ( far - near );

    			} else if ( coordinateSystem === WebGPUCoordinateSystem ) {

    				c = - far / ( far - near );
    				d = ( - far * near ) / ( far - near );

    			} else {

    				throw new Error( 'THREE.Matrix4.makePerspective(): Invalid coordinate system: ' + coordinateSystem );

    			}

    		}

    		te[ 0 ] = x;	te[ 4 ] = 0;	te[ 8 ] = a; 	te[ 12 ] = 0;
    		te[ 1 ] = 0;	te[ 5 ] = y;	te[ 9 ] = b; 	te[ 13 ] = 0;
    		te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = c; 	te[ 14 ] = d;
    		te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = -1;	te[ 15 ] = 0;

    		return this;

    	}

    	/**
    	 * Creates a orthographic projection matrix. This is used internally by
    	 * {@link OrthographicCamera#updateProjectionMatrix}.

    	 * @param {number} left - Left boundary of the viewing frustum at the near plane.
    	 * @param {number} right - Right boundary of the viewing frustum at the near plane.
    	 * @param {number} top - Top boundary of the viewing frustum at the near plane.
    	 * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
    	 * @param {number} near - The distance from the camera to the near plane.
    	 * @param {number} far - The distance from the camera to the far plane.
    	 * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
    	 * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	makeOrthographic( left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false ) {

    		const te = this.elements;

    		const x = 2 / ( right - left );
    		const y = 2 / ( top - bottom );

    		const a = - ( right + left ) / ( right - left );
    		const b = - ( top + bottom ) / ( top - bottom );

    		let c, d;

    		if ( reversedDepth ) {

    			c = 1 / ( far - near );
    			d = far / ( far - near );

    		} else {

    			if ( coordinateSystem === WebGLCoordinateSystem ) {

    				c = -2 / ( far - near );
    				d = - ( far + near ) / ( far - near );

    			} else if ( coordinateSystem === WebGPUCoordinateSystem ) {

    				c = -1 / ( far - near );
    				d = - near / ( far - near );

    			} else {

    				throw new Error( 'THREE.Matrix4.makeOrthographic(): Invalid coordinate system: ' + coordinateSystem );

    			}

    		}

    		te[ 0 ] = x;		te[ 4 ] = 0;		te[ 8 ] = 0; 		te[ 12 ] = a;
    		te[ 1 ] = 0; 		te[ 5 ] = y;		te[ 9 ] = 0; 		te[ 13 ] = b;
    		te[ 2 ] = 0; 		te[ 6 ] = 0;		te[ 10 ] = c;		te[ 14 ] = d;
    		te[ 3 ] = 0; 		te[ 7 ] = 0;		te[ 11 ] = 0;		te[ 15 ] = 1;

    		return this;

    	}

    	/**
    	 * Returns `true` if this matrix is equal with the given one.
    	 *
    	 * @param {Matrix4} matrix - The matrix to test for equality.
    	 * @return {boolean} Whether this matrix is equal with the given one.
    	 */
    	equals( matrix ) {

    		const te = this.elements;
    		const me = matrix.elements;

    		for ( let i = 0; i < 16; i ++ ) {

    			if ( te[ i ] !== me[ i ] ) return false;

    		}

    		return true;

    	}

    	/**
    	 * Sets the elements of the matrix from the given array.
    	 *
    	 * @param {Array<number>} array - The matrix elements in column-major order.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Matrix4} A reference to this matrix.
    	 */
    	fromArray( array, offset = 0 ) {

    		for ( let i = 0; i < 16; i ++ ) {

    			this.elements[ i ] = array[ i + offset ];

    		}

    		return this;

    	}

    	/**
    	 * Writes the elements of this matrix to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number>} [array=[]] - The target array holding the matrix elements in column-major order.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number>} The matrix elements in column-major order.
    	 */
    	toArray( array = [], offset = 0 ) {

    		const te = this.elements;

    		array[ offset ] = te[ 0 ];
    		array[ offset + 1 ] = te[ 1 ];
    		array[ offset + 2 ] = te[ 2 ];
    		array[ offset + 3 ] = te[ 3 ];

    		array[ offset + 4 ] = te[ 4 ];
    		array[ offset + 5 ] = te[ 5 ];
    		array[ offset + 6 ] = te[ 6 ];
    		array[ offset + 7 ] = te[ 7 ];

    		array[ offset + 8 ] = te[ 8 ];
    		array[ offset + 9 ] = te[ 9 ];
    		array[ offset + 10 ] = te[ 10 ];
    		array[ offset + 11 ] = te[ 11 ];

    		array[ offset + 12 ] = te[ 12 ];
    		array[ offset + 13 ] = te[ 13 ];
    		array[ offset + 14 ] = te[ 14 ];
    		array[ offset + 15 ] = te[ 15 ];

    		return array;

    	}

    }

    const _v1$7 = /*@__PURE__*/ new Vector3();
    const _m1$2 = /*@__PURE__*/ new Matrix4();
    const _zero = /*@__PURE__*/ new Vector3( 0, 0, 0 );
    const _one = /*@__PURE__*/ new Vector3( 1, 1, 1 );
    const _x = /*@__PURE__*/ new Vector3();
    const _y = /*@__PURE__*/ new Vector3();
    const _z = /*@__PURE__*/ new Vector3();

    const _matrix$2 = /*@__PURE__*/ new Matrix4();
    const _quaternion$4 = /*@__PURE__*/ new Quaternion();

    /**
     * A class representing Euler angles.
     *
     * Euler angles describe a rotational transformation by rotating an object on
     * its various axes in specified amounts per axis, and a specified axis
     * order.
     *
     * Iterating through an instance will yield its components (x, y, z,
     * order) in the corresponding order.
     *
     * ```js
     * const a = new THREE.Euler( 0, 1, 1.57, 'XYZ' );
     * const b = new THREE.Vector3( 1, 0, 1 );
     * b.applyEuler(a);
     * ```
     */
    class Euler {

    	/**
    	 * Constructs a new euler instance.
    	 *
    	 * @param {number} [x=0] - The angle of the x axis in radians.
    	 * @param {number} [y=0] - The angle of the y axis in radians.
    	 * @param {number} [z=0] - The angle of the z axis in radians.
    	 * @param {string} [order=Euler.DEFAULT_ORDER] - A string representing the order that the rotations are applied.
    	 */
    	constructor( x = 0, y = 0, z = 0, order = Euler.DEFAULT_ORDER ) {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		this.isEuler = true;

    		this._x = x;
    		this._y = y;
    		this._z = z;
    		this._order = order;

    	}

    	/**
    	 * The angle of the x axis in radians.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get x() {

    		return this._x;

    	}

    	set x( value ) {

    		this._x = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * The angle of the y axis in radians.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get y() {

    		return this._y;

    	}

    	set y( value ) {

    		this._y = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * The angle of the z axis in radians.
    	 *
    	 * @type {number}
    	 * @default 0
    	 */
    	get z() {

    		return this._z;

    	}

    	set z( value ) {

    		this._z = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * A string representing the order that the rotations are applied.
    	 *
    	 * @type {string}
    	 * @default 'XYZ'
    	 */
    	get order() {

    		return this._order;

    	}

    	set order( value ) {

    		this._order = value;
    		this._onChangeCallback();

    	}

    	/**
    	 * Sets the Euler components.
    	 *
    	 * @param {number} x - The angle of the x axis in radians.
    	 * @param {number} y - The angle of the y axis in radians.
    	 * @param {number} z - The angle of the z axis in radians.
    	 * @param {string} [order] - A string representing the order that the rotations are applied.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	set( x, y, z, order = this._order ) {

    		this._x = x;
    		this._y = y;
    		this._z = z;
    		this._order = order;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Returns a new Euler instance with copied values from this instance.
    	 *
    	 * @return {Euler} A clone of this instance.
    	 */
    	clone() {

    		return new this.constructor( this._x, this._y, this._z, this._order );

    	}

    	/**
    	 * Copies the values of the given Euler instance to this instance.
    	 *
    	 * @param {Euler} euler - The Euler instance to copy.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	copy( euler ) {

    		this._x = euler._x;
    		this._y = euler._y;
    		this._z = euler._z;
    		this._order = euler._order;

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets the angles of this Euler instance from a pure rotation matrix.
    	 *
    	 * @param {Matrix4} m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
    	 * @param {string} [order] - A string representing the order that the rotations are applied.
    	 * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	setFromRotationMatrix( m, order = this._order, update = true ) {

    		const te = m.elements;
    		const m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ];
    		const m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ];
    		const m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ];

    		switch ( order ) {

    			case 'XYZ':

    				this._y = Math.asin( clamp( m13, -1, 1 ) );

    				if ( Math.abs( m13 ) < 0.9999999 ) {

    					this._x = Math.atan2( - m23, m33 );
    					this._z = Math.atan2( - m12, m11 );

    				} else {

    					this._x = Math.atan2( m32, m22 );
    					this._z = 0;

    				}

    				break;

    			case 'YXZ':

    				this._x = Math.asin( - clamp( m23, -1, 1 ) );

    				if ( Math.abs( m23 ) < 0.9999999 ) {

    					this._y = Math.atan2( m13, m33 );
    					this._z = Math.atan2( m21, m22 );

    				} else {

    					this._y = Math.atan2( - m31, m11 );
    					this._z = 0;

    				}

    				break;

    			case 'ZXY':

    				this._x = Math.asin( clamp( m32, -1, 1 ) );

    				if ( Math.abs( m32 ) < 0.9999999 ) {

    					this._y = Math.atan2( - m31, m33 );
    					this._z = Math.atan2( - m12, m22 );

    				} else {

    					this._y = 0;
    					this._z = Math.atan2( m21, m11 );

    				}

    				break;

    			case 'ZYX':

    				this._y = Math.asin( - clamp( m31, -1, 1 ) );

    				if ( Math.abs( m31 ) < 0.9999999 ) {

    					this._x = Math.atan2( m32, m33 );
    					this._z = Math.atan2( m21, m11 );

    				} else {

    					this._x = 0;
    					this._z = Math.atan2( - m12, m22 );

    				}

    				break;

    			case 'YZX':

    				this._z = Math.asin( clamp( m21, -1, 1 ) );

    				if ( Math.abs( m21 ) < 0.9999999 ) {

    					this._x = Math.atan2( - m23, m22 );
    					this._y = Math.atan2( - m31, m11 );

    				} else {

    					this._x = 0;
    					this._y = Math.atan2( m13, m33 );

    				}

    				break;

    			case 'XZY':

    				this._z = Math.asin( - clamp( m12, -1, 1 ) );

    				if ( Math.abs( m12 ) < 0.9999999 ) {

    					this._x = Math.atan2( m32, m22 );
    					this._y = Math.atan2( m13, m11 );

    				} else {

    					this._x = Math.atan2( - m23, m33 );
    					this._y = 0;

    				}

    				break;

    			default:

    				warn( 'Euler: .setFromRotationMatrix() encountered an unknown order: ' + order );

    		}

    		this._order = order;

    		if ( update === true ) this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Sets the angles of this Euler instance from a normalized quaternion.
    	 *
    	 * @param {Quaternion} q - A normalized Quaternion.
    	 * @param {string} [order] - A string representing the order that the rotations are applied.
    	 * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	setFromQuaternion( q, order, update ) {

    		_matrix$2.makeRotationFromQuaternion( q );

    		return this.setFromRotationMatrix( _matrix$2, order, update );

    	}

    	/**
    	 * Sets the angles of this Euler instance from the given vector.
    	 *
    	 * @param {Vector3} v - The vector.
    	 * @param {string} [order] - A string representing the order that the rotations are applied.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	setFromVector3( v, order = this._order ) {

    		return this.set( v.x, v.y, v.z, order );

    	}

    	/**
    	 * Resets the euler angle with a new order by creating a quaternion from this
    	 * euler angle and then setting this euler angle with the quaternion and the
    	 * new order.
    	 *
    	 * Warning: This discards revolution information.
    	 *
    	 * @param {string} [newOrder] - A string representing the new order that the rotations are applied.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	reorder( newOrder ) {

    		_quaternion$4.setFromEuler( this );

    		return this.setFromQuaternion( _quaternion$4, newOrder );

    	}

    	/**
    	 * Returns `true` if this Euler instance is equal with the given one.
    	 *
    	 * @param {Euler} euler - The Euler instance to test for equality.
    	 * @return {boolean} Whether this Euler instance is equal with the given one.
    	 */
    	equals( euler ) {

    		return ( euler._x === this._x ) && ( euler._y === this._y ) && ( euler._z === this._z ) && ( euler._order === this._order );

    	}

    	/**
    	 * Sets this Euler instance's components to values from the given array. The first three
    	 * entries of the array are assign to the x,y and z components. An optional fourth entry
    	 * defines the Euler order.
    	 *
    	 * @param {Array<number,number,number,?string>} array - An array holding the Euler component values.
    	 * @return {Euler} A reference to this Euler instance.
    	 */
    	fromArray( array ) {

    		this._x = array[ 0 ];
    		this._y = array[ 1 ];
    		this._z = array[ 2 ];
    		if ( array[ 3 ] !== undefined ) this._order = array[ 3 ];

    		this._onChangeCallback();

    		return this;

    	}

    	/**
    	 * Writes the components of this Euler instance to the given array. If no array is provided,
    	 * the method returns a new instance.
    	 *
    	 * @param {Array<number,number,number,string>} [array=[]] - The target array holding the Euler components.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Array<number,number,number,string>} The Euler components.
    	 */
    	toArray( array = [], offset = 0 ) {

    		array[ offset ] = this._x;
    		array[ offset + 1 ] = this._y;
    		array[ offset + 2 ] = this._z;
    		array[ offset + 3 ] = this._order;

    		return array;

    	}

    	_onChange( callback ) {

    		this._onChangeCallback = callback;

    		return this;

    	}

    	_onChangeCallback() {}

    	*[ Symbol.iterator ]() {

    		yield this._x;
    		yield this._y;
    		yield this._z;
    		yield this._order;

    	}

    }

    /**
     * The default Euler angle order.
     *
     * @static
     * @type {string}
     * @default 'XYZ'
     */
    Euler.DEFAULT_ORDER = 'XYZ';

    /**
     * Represents a 2x2 matrix.
     *
     * A Note on Row-Major and Column-Major Ordering:
     *
     * The constructor and {@link Matrix2#set} method take arguments in
     * [row-major](https://en.wikipedia.org/wiki/Row-_and_column-major_order#Column-major_order)
     * order, while internally they are stored in the {@link Matrix2#elements} array in column-major order.
     * This means that calling:
     * ```js
     * const m = new THREE.Matrix2();
     * m.set( 11, 12,
     *        21, 22 );
     * ```
     * will result in the elements array containing:
     * ```js
     * m.elements = [ 11, 21,
     *                12, 22 ];
     * ```
     * and internally all calculations are performed using column-major ordering.
     * However, as the actual ordering makes no difference mathematically and
     * most people are used to thinking about matrices in row-major order, the
     * three.js documentation shows matrices in row-major order. Just bear in
     * mind that if you are reading the source code, you'll have to take the
     * transpose of any matrices outlined here to make sense of the calculations.
     */
    class Matrix2 {

    	static {

    		/**
    		 * This flag can be used for type testing.
    		 *
    		 * @type {boolean}
    		 * @readonly
    		 * @default true
    		 */
    		Matrix2.prototype.isMatrix2 = true;

    	}

    	/**
    	 * Constructs a new 2x2 matrix. The arguments are supposed to be
    	 * in row-major order. If no arguments are provided, the constructor
    	 * initializes the matrix as an identity matrix.
    	 *
    	 * @param {number} [n11] - 1-1 matrix element.
    	 * @param {number} [n12] - 1-2 matrix element.
    	 * @param {number} [n21] - 2-1 matrix element.
    	 * @param {number} [n22] - 2-2 matrix element.
    	 */
    	constructor( n11, n12, n21, n22 ) {

    		/**
    		 * A column-major list of matrix values.
    		 *
    		 * @type {Array<number>}
    		 */
    		this.elements = [
    			1, 0,
    			0, 1,
    		];

    		if ( n11 !== undefined ) {

    			this.set( n11, n12, n21, n22 );

    		}

    	}

    	/**
    	 * Sets this matrix to the 2x2 identity matrix.
    	 *
    	 * @return {Matrix2} A reference to this matrix.
    	 */
    	identity() {

    		this.set(
    			1, 0,
    			0, 1,
    		);

    		return this;

    	}

    	/**
    	 * Sets the elements of the matrix from the given array.
    	 *
    	 * @param {Array<number>} array - The matrix elements in column-major order.
    	 * @param {number} [offset=0] - Index of the first element in the array.
    	 * @return {Matrix2} A reference to this matrix.
    	 */
    	fromArray( array, offset = 0 ) {

    		for ( let i = 0; i < 4; i ++ ) {

    			this.elements[ i ] = array[ i + offset ];

    		}

    		return this;

    	}

    	/**
    	 * Sets the elements of the matrix.The arguments are supposed to be
    	 * in row-major order.
    	 *
    	 * @param {number} n11 - 1-1 matrix element.
    	 * @param {number} n12 - 1-2 matrix element.
    	 * @param {number} n21 - 2-1 matrix element.
    	 * @param {number} n22 - 2-2 matrix element.
    	 * @return {Matrix2} A reference to this matrix.
    	 */
    	set( n11, n12, n21, n22 ) {

    		const te = this.elements;

    		te[ 0 ] = n11; te[ 2 ] = n12;
    		te[ 1 ] = n21; te[ 3 ] = n22;

    		return this;

    	}

    }

    if ( typeof __THREE_DEVTOOLS__ !== 'undefined' ) {

    	__THREE_DEVTOOLS__.dispatchEvent( new CustomEvent( 'register', { detail: {
    		revision: REVISION,
    	} } ) );

    }

    if ( typeof window !== 'undefined' ) {

    	if ( window.__THREE__ ) {

    		warn( 'WARNING: Multiple instances of Three.js being imported.' );

    	} else {

    		window.__THREE__ = REVISION;

    	}

    }

    /**
     * @license
     * Copyright 2010-2026 Three.js Authors
     * SPDX-License-Identifier: MIT
     */
    const _m$1 = /*@__PURE__*/ new Matrix3();

    _m$1.set( -1, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 );
    const _m = /*@__PURE__*/ new Matrix3();

    _m.set( -1, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 );

    /**
     * 프라운호퍼 파장과 색상
     */
    const WAVELENGTHS = {
        g: { nm: 435.84, color: 0x8b5cf6 }, // violet / blue-violet
        F: { nm: 486.1, color: 0x3b82f6 }, // blue
        e: { nm: 546.07, color: 0x22c55e }, // green
        d: { nm: 587.56, color: 0xfacc15 }, // yellow
        C: { nm: 656.27, color: 0xef4444 }, // red
        r: { nm: 706.52, color: 0x991b1b }, // deep red
    };
    /**
     * 매질별 프라운오퍼 파장과 굴절률
     */
    const FRAUNHOFER_REFRACTIVE_INDICES = {
        air: {
            F: 1,
            e: 1,
            d: 1,
            C: 1,
        },
        // bk-7
        crown_glass: {
            g: 1.526684, // 435.84 nm
            F: 1.522379, // 486.10 nm
            e: 1.518722, // 546.07 nm
            d: 1.516800, // 587.56 nm
            C: 1.514322, // 656.27 nm
            r: 1.512892, // 706.52 nm
        },
        // 저굴절 CR-39 계열
        plastic_150: {
            F: 1.50738,
            e: 1.50200,
            d: 1.50000,
            C: 1.49860,
        },
        // 중굴절 MR-8 계열
        plastic_160: {
            F: 1.61800,
            e: 1.60720,
            d: 1.60000,
            C: 1.59430,
        },
        // 고굴절 MR-174
        plastic_167: {
            F: 1.68600,
            e: 1.67300,
            d: 1.67000,
            C: 1.66200,
        },
        // 초고굴절 MR-174
        plastic_174: {
            F: 1.76100,
            e: 1.74800,
            d: 1.74000,
            C: 1.73200,
        },
        cornea: {
            F: 1.377468,
            e: 1.376502,
            d: 1.376,
            C: 1.375368,
        },
        aqueous: {
            F: 1.337312,
            e: 1.336449,
            d: 1.336,
            C: 1.335435,
        },
        vitreous: {
            F: 1.337312,
            e: 1.336449,
            d: 1.336,
            C: 1.335435,
        },
        lens: {
            F: 1.407585,
            e: 1.406542,
            d: 1.406,
            C: 1.405318,
        },
        lens_anterior: {
            F: 1.387507,
            e: 1.386516,
            d: 1.386,
            C: 1.385351,
        },
        lens_nucleus_anterior: {
            F: 1.407585,
            e: 1.406542,
            d: 1.406,
            C: 1.405318,
        },
        lens_nucleus_posterior: {
            F: 1.387507,
            e: 1.386516,
            d: 1.386,
            C: 1.385351,
        },
        lens_posterior: {
            F: 1.337312,
            e: 1.336449,
            d: 1.336,
            C: 1.335435,
        },
    };
    /**
     * 동공 크기
     */
    const PUPIL_SIZE = {
        /** 축동 — 동공 수축 */
        constricted: 2.5,
        /** 일반 */
        neutral: 4,
        /** 산동 — 동공 확대 */
        dilated: 6,
    };
    /**
     * 망막 뒤 광선 연장 거리
     */
    const RETINA_EXTRA_AFTER_MM = 18.00;
    /**
     * epsilon
     */
    const EPSILON = 1e-9;
    /**
     * 굴절 후 광선을 아주 조금 전진시켜 self-intersection을 방지하기 위한 거리(mm)
     */
    const RAY_SURFACE_ESCAPE_MM = 2e-3;
    /**
     * ST(Sphere-Toric) 복합면에서 굴절력 0으로 판단하는 임계값(D)
     */
    const ST_POWER_EPS_D = 1e-9;
    /**
     * ST(Sphere-Toric) 복합면의 기본 두께(mm)
     */
    const ST_DEFAULT_THICKNESS_MM = 0.05;
    /**
     * 안구 보정 ST면(eye)의 기본 위치: 각막 전면 바로 앞(mm)
     */
    const EYE_ST_SURFACE_OFFSET_MM = 0.02;
    /**
     * 안경 렌즈 ST면(lens)의 기본 정간거리 Vertex Distance(mm)
     */
    const SPECTACLE_VERTEX_DISTANCE_MM = 12;
    /**
     * Toric 면 교점 탐색 시 현재 점과의 자기 재교차를 피하기 위한 최소 전진 거리(mm)
     */
    const TORIC_MIN_T_MM = 1e-6;
    /**
     * Toric 면 교점 계산(뉴턴법) 최대 반복 횟수
     */
    const TORIC_MAX_ITERS = 24;
    /**
     * 광선 시작점이 이미 Toric 면 위에 있다고 판단하는 허용 오차(mm)
     */
    const TORIC_ON_SURFACE_TOL_MM = 1e-6;
    /**
     * 동일 z 부근 연속 표면에서 수치 오차로 인한 미세 간격을 허용하는 오차(mm)
     */
    const TORIC_COINCIDENT_SURFACE_TOL_MM = 3e-3;
    /**
     * Sturm 분석에서 Top2 선택 시 허용하는 최소 z 간격(mm)
     */
    const DEFAULT_STURM_TOP2_MIN_GAP_MM = 0.0;
    /**
     * Sturm 분석에서 Top2 선택 시 허용하는 최소 축 각도 차(도)
     */
    const DEFAULT_STURM_TOP2_MIN_ANGLE_GAP_DEG = 45;
    /**
     * 실효 난시량이 이 값(D) 이상이면 U/V 중간점을 CLC 근사 중심으로 우선 사용
     */
    const DEFAULT_EFFECTIVE_CYLINDER_THRESHOLD_D = 0.125;
    /**
     * Sturm z-scan 간격(mm)
     */
    const DEFAULT_STURM_STEP_MM = 0.01;

    const DEFAULT_DIR = new Vector3(0, 0, 1);
    function isFiniteVector3(v) {
        return (!!v &&
            Number.isFinite(Number(v.x)) &&
            Number.isFinite(Number(v.y)) &&
            Number.isFinite(Number(v.z)));
    }
    /**
     * 프라운호퍼 D선 광선이 기본 입니다.
     * 기본 색은 노란색입니다.
     */
    class Ray {
        constructor({ origin, direction = new Vector3(0, 0, 1), frounhofer_line = 'd' }) {
            this.origin = isFiniteVector3(origin)
                ? origin.clone()
                : new Vector3(0, 0, 0);
            this.direction = isFiniteVector3(direction)
                ? direction.clone().normalize()
                : DEFAULT_DIR.clone();
            if (!isFiniteVector3(this.direction) || this.direction.lengthSq() < EPSILON) {
                this.direction = DEFAULT_DIR.clone();
            }
            this.frounhofer_line = frounhofer_line;
            this.wavelengthNm = WAVELENGTHS[frounhofer_line]
                ? WAVELENGTHS[frounhofer_line].nm
                : WAVELENGTHS.d.nm;
            this.displayColor = WAVELENGTHS[frounhofer_line].color;
            this.points = [this.origin.clone()];
        }
        appendPoint(point) {
            if (!isFiniteVector3(point))
                return;
            this.points.push(point.clone());
        }
        endPoint() {
            return this.points[this.points.length - 1].clone();
        }
        getDirection() {
            return this.direction.clone();
        }
        getWavelengthNm() {
            return this.wavelengthNm;
        }
        getFraunhoferLine() {
            return this.frounhofer_line;
        }
        clone() {
            const cloned = new Ray({
                origin: this.origin,
                direction: this.direction,
                frounhofer_line: this.frounhofer_line
            });
            cloned.points = this.points.map((point) => point.clone());
            return cloned;
        }
        continueFrom(nextOrigin, nextDirection) {
            if (!isFiniteVector3(nextOrigin) || !isFiniteVector3(nextDirection))
                return;
            const dir = nextDirection.clone().normalize();
            if (!isFiniteVector3(dir) || dir.lengthSq() < EPSILON)
                return;
            this.origin.copy(nextOrigin);
            this.direction.copy(dir);
            const last = this.endPoint();
            if (last.distanceToSquared(nextOrigin) > EPSILON) {
                this.appendPoint(nextOrigin);
            }
        }
    }

    class LightSource {
        constructor() {
            this.rays = [];
        }
        directionFromVergence(origin, z, vergence) {
            if (!Number.isFinite(vergence) || Math.abs(vergence) < 1e-12) {
                return new Vector3(0, 0, 1);
            }
            const focalDistanceMm = 1000 / Math.abs(vergence);
            const focalPoint = new Vector3(0, 0, z + (vergence > 0 ? focalDistanceMm : -focalDistanceMm));
            const direction = vergence > 0
                ? focalPoint.clone().sub(origin)
                : origin.clone().sub(focalPoint);
            if (direction.lengthSq() < 1e-12) {
                return new Vector3(0, 0, 1);
            }
            return direction.normalize();
        }
        createRayFromPoint(origin, z, vergence) {
            const direction = this.directionFromVergence(origin, z, vergence);
            this.addRay(new Ray({
                origin,
                direction,
                frounhofer_line: "d",
            }));
        }
        createChromaticRayFromPoint(origin, z, vergence, line, chromaticVergenceOffset = 0) {
            const direction = this.directionFromVergence(origin, z, vergence + chromaticVergenceOffset);
            this.addRay(new Ray({
                origin,
                direction,
                frounhofer_line: line,
            }));
        }
        addRay(ray) {
            this.rays.push(ray.clone());
        }
        emitRays() {
            return this.rays.map((ray) => ray.clone());
        }
    }
    class GridLightSource extends LightSource {
        constructor(props) {
            const { width, height, division = 4, z, vergence = 0 } = props;
            if (division < 4) {
                throw new Error("division must be greater than 4");
            }
            if (width < 0 || height < 0) {
                throw new Error("width and height must be greater than 0");
            }
            if (z > 0) {
                throw new Error("z must be lesser than 0");
            }
            super();
            this.width = 0;
            this.height = 0;
            this.division = 0;
            this.z = 0;
            this.vergence = 0;
            this.width = width;
            this.height = height;
            this.division = division;
            this.z = z;
            this.vergence = vergence;
            const xStep = this.division > 1 ? this.width / (this.division - 1) : 0;
            const yStep = this.division > 1 ? this.height / (this.division - 1) : 0;
            const xStart = -this.width / 2;
            const yStart = -this.height / 2;
            for (let yi = 0; yi < this.division; yi += 1) {
                const y = yStart + yi * yStep;
                for (let xi = 0; xi < this.division; xi += 1) {
                    const x = xStart + xi * xStep;
                    const origin = new Vector3(x, y, this.z);
                    this.createRayFromPoint(origin, this.z, this.vergence);
                }
            }
        }
    }
    class GridRGLightSource extends LightSource {
        constructor(props) {
            const { width, height, division = 4, z, vergence = 0 } = props;
            if (division < 4) {
                throw new Error("division must be greater than 4");
            }
            if (width < 0 || height < 0) {
                throw new Error("width and height must be greater than 0");
            }
            if (z > 0) {
                throw new Error("z must be lesser than 0");
            }
            super();
            this.width = 0;
            this.height = 0;
            this.division = 0;
            this.z = 0;
            this.vergence = 0;
            this.width = width;
            this.height = height;
            this.division = division;
            this.z = z;
            this.vergence = vergence;
            const xStep = this.division > 1 ? this.width / (this.division - 1) : 0;
            const yStep = this.division > 1 ? this.height / (this.division - 1) : 0;
            const xStart = -this.width / 2;
            const yStart = -this.height / 2;
            for (let yi = 0; yi < this.division; yi += 1) {
                const y = yStart + yi * yStep;
                for (let xi = 0; xi < this.division; xi += 1) {
                    const x = xStart + xi * xStep;
                    const origin = new Vector3(x, y, this.z);
                    this.createChromaticRayFromPoint(origin, this.z, this.vergence, "e");
                    this.createChromaticRayFromPoint(origin, this.z, this.vergence, "C");
                }
            }
        }
    }
    class RadialLightSource extends LightSource {
        constructor(props) {
            const { radius, division = 4, angle_division = 4, z, vergence = 0 } = props;
            if (radius < 0) {
                throw new Error("radius must be greater than or equal to 0");
            }
            if (division < 4) {
                throw new Error("division must be greater than 4");
            }
            if (angle_division < 4) {
                throw new Error("angle_division must be greater than 4");
            }
            if (z > 0) {
                throw new Error("z must be lesser than 0");
            }
            super();
            this.radius = 0;
            this.division = 0;
            this.angle_division = 0;
            this.z = 0;
            this.vergence = 0;
            this.radius = radius;
            this.division = division;
            this.angle_division = angle_division;
            this.z = z;
            this.vergence = vergence;
            this.createRayFromPoint(new Vector3(0, 0, this.z), this.z, this.vergence);
            for (let ring = 1; ring <= this.division; ring += 1) {
                const ringRadius = (this.radius * ring) / this.division;
                for (let ai = 0; ai < this.angle_division; ai += 1) {
                    const theta = (2 * Math.PI * ai) / this.angle_division;
                    const x = ringRadius * Math.cos(theta);
                    const y = ringRadius * Math.sin(theta);
                    const origin = new Vector3(x, y, this.z);
                    this.createRayFromPoint(origin, this.z, this.vergence);
                }
            }
        }
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }
    function resolveRefractiveIndex(spec, line) {
        if (isFiniteNumber(spec))
            return spec;
        const lineValue = spec[line];
        if (isFiniteNumber(lineValue))
            return lineValue;
        const dValue = spec.d;
        if (isFiniteNumber(dValue))
            return dValue;
        return 1.0;
    }
    function normalizeRefractiveIndexSpec(spec) {
        if (!isFiniteNumber(spec))
            return spec;
        const entries = Object.values(FRAUNHOFER_REFRACTIVE_INDICES);
        const matched = entries.find((item) => isFiniteNumber(item.d) && Math.abs(item.d - spec) < 1e-6);
        return matched ?? spec;
    }

    class Surface {
        constructor(props) {
            this.type = "";
            this.name = "";
            this.position = new Vector3(0, 0, 0);
            this.tilt = new Vector2(0, 0);
            this.meridians = [];
            const { type, name, position, tilt } = props;
            this.type = type;
            this.name = name;
            this.position = new Vector3(position.x, position.y, position.z);
            this.tilt = new Vector2(tilt.x, tilt.y);
            this.incidentRays = [];
            this.refractedRays = [];
        }
    }

    class AsphericalSurface extends Surface {
        constructor(props) {
            super({ type: "aspherical", name: props.name, position: props.position, tilt: props.tilt });
            this.r = 0;
            this.conic = 0;
            this.n_before = 1.0;
            this.n_after = 1.0;
            const { r, conic = -1, n_before = 1.0, n_after = 1.0 } = props;
            this.r = r;
            this.conic = conic;
            this.n_before = normalizeRefractiveIndexSpec(n_before);
            this.n_after = normalizeRefractiveIndexSpec(n_after);
        }
        refractiveIndicesForRay(ray) {
            const line = ray.getFraunhoferLine();
            return {
                nBefore: resolveRefractiveIndex(this.n_before, line),
                nAfter: resolveRefractiveIndex(this.n_after, line),
            };
        }
        /**
         * 비구면 사그(sag)와 그 기울기(미분)를 계산합니다.
         *
         * 회전대칭 비구면 식:
         * z = c*rho^2 / (1 + sqrt(1 - (1+k)*c^2*rho^2))
         * - c = 1 / R (곡률)
         * - k = conic constant
         * - rho^2 = x^2 + y^2
         *
         * 반환값:
         * - sag: 꼭지점 기준 z 변위(mm)
         * - dzdx, dzdy: 표면 기울기 (법선 계산과 뉴턴법 미분에 사용)
         */
        geometryAtXY(x, y) {
            if (!Number.isFinite(this.r) || Math.abs(this.r) < EPSILON)
                return null;
            const curvature = 1 / this.r;
            const rho2 = x * x + y * y;
            const onePlusConic = 1 + this.conic;
            const b = 1 - onePlusConic * curvature * curvature * rho2;
            // 루트 내부가 큰 음수면 이 좌표는 표면 정의역 밖입니다.
            if (b < -1e-3)
                return null;
            const sqrtB = Math.sqrt(Math.max(0, b));
            const denom = 1 + sqrtB;
            if (Math.abs(denom) < EPSILON || Math.abs(sqrtB) < EPSILON)
                return null;
            const sag = (curvature * rho2) / denom;
            // d(rho^2)/dx, d(rho^2)/dy
            const dRho2dx = 2 * x;
            const dRho2dy = 2 * y;
            // b = 1 - alpha * rho^2, alpha = (1+k)c^2
            const alpha = onePlusConic * curvature * curvature;
            const dBdx = -alpha * dRho2dx;
            const dBdy = -alpha * dRho2dy;
            const dSqrtBdx = dBdx / (2 * sqrtB);
            const dSqrtBdy = dBdy / (2 * sqrtB);
            // z = N / D, N = c*rho^2, D = 1 + sqrtB
            const n = curvature * rho2;
            const dNdx = curvature * dRho2dx;
            const dNdy = curvature * dRho2dy;
            const dDdx = dSqrtBdx;
            const dDdy = dSqrtBdy;
            const denom2 = denom * denom;
            const dzdx = (dNdx * denom - n * dDdx) / denom2;
            const dzdy = (dNdy * denom - n * dDdy) / denom2;
            const normal = new Vector3(-dzdx, -dzdy, 1).normalize();
            return { sag, dzdx, dzdy, normal };
        }
        /**
         * 광선 파라미터 t에서의 표면 방정식 값 f(t)를 계산합니다.
         * f(t)=0 이면 교점입니다.
         */
        surfaceEquationAtT(origin, direction, t) {
            if (!Number.isFinite(t) || t < AsphericalSurface.MIN_T)
                return null;
            const p = origin.clone().addScaledVector(direction, t);
            const geometry = this.geometryAtXY(p.x, p.y);
            if (!geometry)
                return null;
            return p.z - (this.position.z + geometry.sag);
        }
        /**
         * 뉴턴법이 실패했을 때를 대비해, 일정 구간에서 부호가 바뀌는 브래킷을 찾습니다.
         */
        scanBracketRange(origin, direction, tMin, tMax, samples) {
            if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin)
                return null;
            const n = Math.max(8, Math.floor(samples));
            let prevT = tMin;
            let prevF = this.surfaceEquationAtT(origin, direction, prevT);
            for (let i = 1; i <= n; i++) {
                const alpha = i / n;
                const t = tMin + (tMax - tMin) * alpha;
                const f = this.surfaceEquationAtT(origin, direction, t);
                if (f == null)
                    continue;
                if (Math.abs(f) < 1e-10) {
                    return { a: Math.max(AsphericalSurface.MIN_T, t - 1e-4), b: t + 1e-4 };
                }
                if (prevF != null && prevF * f <= 0) {
                    return prevT < t ? { a: prevT, b: t } : { a: t, b: prevT };
                }
                prevT = t;
                prevF = f;
            }
            return null;
        }
        /**
         * 브래킷 [a,b] 내부에서 이분법으로 f(t)=0의 근을 찾습니다.
         */
        bisectionRoot(origin, direction, a, b) {
            let left = Math.max(AsphericalSurface.MIN_T, Math.min(a, b));
            let right = Math.max(AsphericalSurface.MIN_T, Math.max(a, b));
            if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left)
                return null;
            let fLeft = this.surfaceEquationAtT(origin, direction, left);
            let fRight = this.surfaceEquationAtT(origin, direction, right);
            if (fLeft == null || fRight == null)
                return null;
            if (Math.abs(fLeft) < 1e-10)
                return left;
            if (Math.abs(fRight) < 1e-10)
                return right;
            if (fLeft * fRight > 0)
                return null;
            for (let i = 0; i < AsphericalSurface.BISECTION_ITERS; i++) {
                const mid = (left + right) * 0.5;
                const fMid = this.surfaceEquationAtT(origin, direction, mid);
                if (fMid == null) {
                    right = mid;
                    continue;
                }
                if (Math.abs(fMid) < 1e-10 || Math.abs(right - left) < 1e-8)
                    return mid;
                if (fLeft * fMid <= 0) {
                    right = mid;
                    fRight = fMid;
                }
                else {
                    left = mid;
                    fLeft = fMid;
                }
                if (!Number.isFinite(fRight))
                    return null;
            }
            return (left + right) * 0.5;
        }
        incident(ray) {
            // 현재 광선 끝점/방향을 기준으로 "앞으로 진행하는 첫 교점"을 찾습니다.
            const origin = ray.endPoint();
            const direction = ray.getDirection().normalize();
            // z-plane 기반의 초기 추정치(뉴턴법 seed)
            let t = Math.abs(direction.z) < EPSILON
                ? Number.NaN
                : (this.position.z - origin.z) / direction.z;
            if (!Number.isFinite(t) || t < AsphericalSurface.MIN_T) {
                t = Math.max(AsphericalSurface.MIN_T, this.position.z - origin.z);
            }
            let convergedT = null;
            // 1) 뉴턴법: 빠른 수렴
            for (let i = 0; i < AsphericalSurface.MAX_ITERS; i++) {
                const p = origin.clone().addScaledVector(direction, t);
                const geometry = this.geometryAtXY(p.x, p.y);
                if (!geometry)
                    break;
                const f = p.z - (this.position.z + geometry.sag);
                const df = direction.z - geometry.dzdx * direction.x - geometry.dzdy * direction.y;
                if (!Number.isFinite(df) || Math.abs(df) < EPSILON)
                    break;
                const dt = f / df;
                t -= dt;
                if (!Number.isFinite(t) || t < AsphericalSurface.MIN_T)
                    break;
                if (Math.abs(dt) < 1e-8) {
                    convergedT = t;
                    break;
                }
            }
            if (Number.isFinite(convergedT) && convergedT >= AsphericalSurface.MIN_T) {
                const hitPoint = origin.clone().addScaledVector(direction, convergedT);
                this.incidentRays.push(ray.clone());
                return hitPoint;
            }
            // 2) 실패 시 브래킷 + 이분법: 느리지만 안정적
            const bracket = this.scanBracketRange(origin, direction, AsphericalSurface.MIN_T, AsphericalSurface.MAX_BRACKET_T_MM, AsphericalSurface.BRACKET_SCAN_STEPS);
            if (!bracket)
                return null;
            const hitT = this.bisectionRoot(origin, direction, bracket.a, bracket.b);
            if (!Number.isFinite(hitT) || hitT < AsphericalSurface.MIN_T)
                return null;
            const hitPoint = origin.clone().addScaledVector(direction, hitT);
            this.incidentRays.push(ray.clone());
            return hitPoint;
        }
        refract(ray) {
            const hitPoint = this.incident(ray);
            if (!hitPoint)
                return null;
            const geometry = this.geometryAtXY(hitPoint.x, hitPoint.y);
            if (!geometry)
                return null;
            // 스넬 굴절 벡터 계산
            const incidentDir = ray.getDirection().normalize();
            const normalIntoSecond = geometry.normal.clone();
            // 법선을 "2번째 매질 쪽" 방향으로 정렬
            if (normalIntoSecond.dot(incidentDir) < 0) {
                normalIntoSecond.multiplyScalar(-1);
            }
            const cos1 = Math.max(-1, Math.min(1, normalIntoSecond.dot(incidentDir)));
            const sin1Sq = Math.max(0, 1 - cos1 * cos1);
            const { nBefore, nAfter } = this.refractiveIndicesForRay(ray);
            const sin2 = (nBefore / nAfter) * Math.sqrt(sin1Sq);
            // 전반사(TIR)
            if (sin2 > 1 + 1e-10)
                return null;
            const cos2 = Math.sqrt(Math.max(0, 1 - sin2 * sin2));
            const tangent = incidentDir.clone().sub(normalIntoSecond.clone().multiplyScalar(cos1));
            const outDirection = tangent.lengthSq() < 1e-12
                ? incidentDir.clone()
                : normalIntoSecond
                    .clone()
                    .multiplyScalar(cos2)
                    .add(tangent.normalize().multiplyScalar(sin2))
                    .normalize();
            const refractedRay = ray.clone();
            refractedRay.appendPoint(hitPoint);
            refractedRay.continueFrom(hitPoint.clone().addScaledVector(outDirection, RAY_SURFACE_ESCAPE_MM), outDirection);
            this.refractedRays.push(refractedRay.clone());
            return refractedRay;
        }
    }
    /**
     * 수치 계산 상수들
     * - MIN_T: 현재 시작점과의 자기 재교차를 피하기 위한 최소 진행 거리
     * - MAX_ITERS: 뉴턴법 반복 횟수
     * - BISECTION_ITERS: 이분법 반복 횟수
     */
    AsphericalSurface.MIN_T = 1e-6;
    AsphericalSurface.MAX_ITERS = 24;
    AsphericalSurface.BISECTION_ITERS = 36;
    AsphericalSurface.BRACKET_SCAN_STEPS = 96;
    AsphericalSurface.MAX_BRACKET_T_MM = 80;

    /**
     * 곡면 표현만 하고 굴절 효과는 없습니다.
     * 망막 위치를 표현하는 데 사용됩니다.
     */
    class SphericalImageSurface extends Surface {
        constructor(props) {
            super({ type: "spherical-image", name: props.name, position: props.position, tilt: props.tilt });
            this.r = 0;
            this.retina_extra_after = true;
            this.hitPoints = [];
            const { r, retina_extra_after = true } = props;
            this.r = r;
            this.retina_extra_after = retina_extra_after;
        }
        /**
         * 반경 값이 비정상이면 평면(z = position.z)으로 처리합니다.
         */
        isPlanar() {
            return !Number.isFinite(this.r) || Math.abs(this.r) > 1e12;
        }
        /**
         * 구면 중심: 꼭지점(position)에서 반경만큼 z축 이동한 점
         */
        sphereCenter() {
            return new Vector3(this.position.x, this.position.y, this.position.z + this.r);
        }
        getHitPoints() {
            return this.hitPoints.map((point) => point.clone());
        }
        incident(ray) {
            // 새 입사 계산을 시작할 때 이전 교점 기록은 초기화합니다.
            this.hitPoints = [];
            const origin = ray.endPoint();
            const direction = ray.getDirection().normalize();
            const minT = 1e-6;
            // 1) 평면 fallback
            if (this.isPlanar()) {
                const dz = direction.z;
                if (!Number.isFinite(dz) || Math.abs(dz) < EPSILON)
                    return null;
                const t = (this.position.z - origin.z) / dz;
                if (!Number.isFinite(t) || t < minT)
                    return null;
                const hitPoint = origin.clone().addScaledVector(direction, t);
                this.incidentRays.push(ray.clone());
                this.hitPoints.push(hitPoint.clone());
                return hitPoint;
            }
            // 2) 구면 교점 (가장 가까운 양의 t)
            const center = this.sphereCenter();
            const oc = origin.clone().sub(center);
            const b = 2 * direction.dot(oc);
            const c = oc.lengthSq() - this.r * this.r;
            const discriminant = b * b - 4 * c;
            if (discriminant < 0)
                return null;
            const root = Math.sqrt(discriminant);
            const t0 = (-b - root) / 2;
            const t1 = (-b + root) / 2;
            const candidates = [t0, t1]
                .filter((t) => Number.isFinite(t) && t > minT)
                .sort((a, b2) => a - b2);
            if (!candidates.length)
                return null;
            const hitPoint = origin.clone().addScaledVector(direction, candidates[0]);
            this.incidentRays.push(ray.clone());
            this.hitPoints.push(hitPoint.clone());
            return hitPoint;
        }
        refract(ray) {
            const hitPoint = this.incident(ray);
            if (!hitPoint)
                return null;
            // 망막면은 굴절하지 않고, 입사 방향을 그대로 유지합니다.
            const outDirection = ray.getDirection().normalize();
            const tracedRay = ray.clone();
            tracedRay.appendPoint(hitPoint);
            // 망막 뒤 연장을 비활성화하면 교점에서 광선을 종료합니다.
            if (!this.retina_extra_after) {
                this.refractedRays.push(tracedRay.clone());
                return tracedRay;
            }
            tracedRay.continueFrom(hitPoint.clone().addScaledVector(outDirection, RAY_SURFACE_ESCAPE_MM), outDirection);
            tracedRay.appendPoint(hitPoint.clone().addScaledVector(outDirection, RETINA_EXTRA_AFTER_MM));
            this.refractedRays.push(tracedRay.clone());
            return tracedRay;
        }
    }

    class SphericalSurface extends Surface {
        constructor(props) {
            super({ type: "spherical", name: props.name, position: props.position, tilt: props.tilt });
            this.r = 0;
            this.n_before = 1.0;
            this.n_after = 1.0;
            const { r, n_before = 1.0, n_after = 1.0 } = props;
            this.r = r;
            this.n_before = normalizeRefractiveIndexSpec(n_before);
            this.n_after = normalizeRefractiveIndexSpec(n_after);
        }
        refractiveIndicesForRay(ray) {
            const line = ray.getFraunhoferLine();
            return {
                nBefore: resolveRefractiveIndex(this.n_before, line),
                nAfter: resolveRefractiveIndex(this.n_after, line),
            };
        }
        /**
         * 반경이 너무 크거나 비정상 값이면 평면으로 간주합니다.
         * (legacy 코드의 planar fallback 동작을 그대로 반영)
         */
        isPlanar() {
            return !Number.isFinite(this.r) || Math.abs(this.r) > 1e12;
        }
        /**
         * 구면의 중심점입니다.
         * 이 프로젝트의 구면은 +Z 축을 기준으로 배치되며,
         * 중심은 꼭지점(position)에서 반경만큼 Z 방향으로 이동한 위치입니다.
         */
        sphereCenter() {
            return new Vector3(this.position.x, this.position.y, this.position.z + this.r);
        }
        /**
         * 굴절 계산에 사용할 "2번째 매질 방향" 법선을 계산합니다.
         * - 평면: +Z 법선 사용
         * - 구면: 반경 부호에 따라 중심-입사점 벡터 방향을 맞춰 사용
         */
        normalIntoSecondMedium(hitPoint) {
            if (this.isPlanar()) {
                return new Vector3(0, 0, 1);
            }
            const center = this.sphereCenter();
            return this.r < 0
                ? hitPoint.clone().sub(center).normalize()
                : center.clone().sub(hitPoint).normalize();
        }
        /**
         * 주어진 XY에서 구면의 z 위치를 계산합니다.
         * - 반경이 매우 큰 경우(평면)에는 평면 z를 반환합니다.
         * - 구면 정의역 밖이면 null을 반환합니다.
         */
        surfaceZAtXY(x, y) {
            if (this.isPlanar())
                return this.position.z;
            const rhoSq = x * x + y * y;
            const rr = this.r * this.r;
            if (rhoSq > rr)
                return null;
            const root = Math.sqrt(Math.max(0, rr - rhoSq));
            const sag = this.r - Math.sign(this.r || 1) * root;
            return this.position.z + sag;
        }
        incident(ray) {
            // 현재 광선의 마지막 점에서, 진행 방향으로 표면과 만나는 첫 교점을 찾습니다.
            const origin = ray.endPoint();
            const direction = ray.getDirection().normalize();
            const minT = 1e-6; // 자기 자신과의 수치적 재충돌 방지
            const onSurfaceTol = TORIC_ON_SURFACE_TOL_MM;
            // ST compound(back->front) 경계에서 escape step으로 origin이 front를 미세하게
            // 앞지르는 경우를 허용하기 위해 tol을 조금 크게 둡니다.
            const coincidentTol = Math.max(TORIC_COINCIDENT_SURFACE_TOL_MM, 5e-2);
            // 1) 평면 fallback: z = this.position.z 면과의 교점
            if (this.isPlanar()) {
                const dz = direction.z;
                if (!Number.isFinite(dz) || Math.abs(dz) < EPSILON)
                    return null;
                const f0 = origin.z - this.position.z;
                if (Math.abs(f0) <= onSurfaceTol) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
                if (f0 > 0
                    && f0 <= coincidentTol
                    && direction.z > 0
                    && this.position.z <= origin.z + coincidentTol) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
                const t = (this.position.z - origin.z) / dz;
                if (!Number.isFinite(t) || t < minT)
                    return null;
                const hitPoint = origin.clone().addScaledVector(direction, t);
                this.incidentRays.push(ray.clone());
                return hitPoint;
            }
            // 2) 구면: |O + tD - C|^2 = r^2 를 풀어 가장 가까운 양의 t 선택
            const zAtOriginXY = this.surfaceZAtXY(origin.x, origin.y);
            if (Number.isFinite(zAtOriginXY)) {
                const f0 = origin.z - zAtOriginXY;
                if (Math.abs(f0) <= onSurfaceTol) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
                if (f0 > 0
                    && f0 <= coincidentTol
                    && direction.z > 0
                    && this.position.z <= origin.z + coincidentTol) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
            }
            const center = this.sphereCenter();
            const oc = origin.clone().sub(center);
            const b = 2 * direction.dot(oc);
            const c = oc.lengthSq() - this.r * this.r;
            const rawDiscriminant = b * b - 4 * c;
            if (rawDiscriminant < -1e-10)
                return null;
            const discriminant = Math.max(0, rawDiscriminant);
            const root = Math.sqrt(discriminant);
            const t0 = (-b - root) / 2;
            const t1 = (-b + root) / 2;
            const candidates = [t0, t1]
                .filter((t) => Number.isFinite(t) && t > minT)
                .sort((a, b2) => a - b2);
            if (!candidates.length)
                return null;
            const hitPoint = origin.clone().addScaledVector(direction, candidates[0]);
            this.incidentRays.push(ray.clone());
            return hitPoint;
        }
        refract(ray) {
            const hitPoint = this.incident(ray);
            if (!hitPoint)
                return null;
            // 스넬의 법칙 벡터형 구현
            const incidentDir = ray.getDirection().normalize();
            const normal = this.normalIntoSecondMedium(hitPoint);
            // 법선과 입사광의 방향이 반대면 법선을 뒤집어 "2번째 매질 방향"으로 정렬
            if (normal.dot(incidentDir) < 0) {
                normal.multiplyScalar(-1);
            }
            const cos1 = Math.max(-1, Math.min(1, normal.dot(incidentDir)));
            const sin1Sq = Math.max(0, 1 - cos1 * cos1);
            const { nBefore, nAfter } = this.refractiveIndicesForRay(ray);
            const sin2 = (nBefore / nAfter) * Math.sqrt(sin1Sq);
            // 전반사(TIR)
            if (sin2 > 1 + 1e-10)
                return null;
            const cos2 = Math.sqrt(Math.max(0, 1 - sin2 * sin2));
            const tangent = incidentDir.clone().sub(normal.clone().multiplyScalar(cos1));
            const outDirection = tangent.lengthSq() < 1e-12
                ? incidentDir.clone()
                : normal.clone()
                    .multiplyScalar(cos2)
                    .add(tangent.normalize().multiplyScalar(sin2))
                    .normalize();
            // 원본 광선을 복제해 굴절된 새 광선으로 이어붙입니다.
            const refractedRay = ray.clone();
            refractedRay.appendPoint(hitPoint);
            refractedRay.continueFrom(hitPoint.clone().addScaledVector(outDirection, RAY_SURFACE_ESCAPE_MM), outDirection);
            this.refractedRays.push(refractedRay.clone());
            return refractedRay;
        }
    }

    class EyeModelParameter {
        constructor(parameter) {
            this.parameter = parameter;
        }
        createSurface() {
            return this.parameter.surfaces.map((surface) => {
                if (surface.type === "spherical") {
                    return new SphericalSurface({
                        type: "spherical",
                        name: surface.name,
                        r: surface.radius,
                        position: { x: 0, y: 0, z: surface.z },
                        tilt: { x: 0, y: 0 },
                        n_before: surface.n_before,
                        n_after: surface.n_after,
                    });
                }
                if (surface.type === "aspherical") {
                    return new AsphericalSurface({
                        type: "aspherical",
                        name: surface.name,
                        position: { x: 0, y: 0, z: surface.z },
                        tilt: { x: 0, y: 0 },
                        r: surface.radius,
                        conic: surface.conic,
                        n_before: surface.n_before,
                        n_after: surface.n_after,
                    });
                }
                if (surface.type === "spherical-image") {
                    return new SphericalImageSurface({
                        type: "spherical-image",
                        name: surface.name,
                        r: surface.radius,
                        position: { x: 0, y: 0, z: surface.z },
                        tilt: { x: 0, y: 0 },
                        retina_extra_after: true,
                    });
                }
                throw new Error(`Unsupported surface type: ${surface.type}`);
            });
        }
    }

    class GullstrandParameter extends EyeModelParameter {
        constructor() {
            super(GullstrandParameter.parameter);
        }
    }
    GullstrandParameter.parameter = {
        unit: "mm",
        axis: "optical_axis_z",
        origin: "cornea_anterior_vertex",
        surfaces: [
            {
                type: "spherical",
                name: "cornea_anterior",
                z: 0.0,
                radius: 7.7,
                n_before: 1.0,
                n_after: 1.376,
            },
            {
                type: "spherical",
                name: "cornea_posterior",
                z: 0.5,
                radius: 6.8,
                n_before: 1.376,
                n_after: 1.336,
            },
            {
                type: "spherical",
                name: "lens_anterior",
                z: 3.6,
                radius: 10.0,
                n_before: 1.336,
                n_after: 1.386,
            },
            {
                type: "spherical",
                name: "lens_nucleus_anterior",
                z: 4.146,
                radius: 7.911,
                n_before: 1.386,
                n_after: 1.406,
            },
            {
                type: "spherical",
                name: "lens_nucleus_posterior",
                z: 6.565,
                radius: -5.76,
                n_before: 1.406,
                n_after: 1.386,
            },
            {
                type: "spherical",
                name: "lens_posterior",
                z: 7.2,
                radius: -6,
                n_before: 1.386,
                n_after: 1.336,
            },
            {
                type: "spherical-image",
                name: "retina",
                radius: -12, // mm (대략적인 망막 곡률)
                z: 24.0 // 중심 위치
            }
        ],
    };

    class NavarroParameter extends EyeModelParameter {
        constructor() {
            super(NavarroParameter.parameter);
        }
    }
    NavarroParameter.parameter = {
        unit: "mm",
        axis: "optical_axis_z",
        surfaces: [
            {
                type: "aspherical",
                name: "cornea_anterior",
                z: 0.0,
                radius: 7.72,
                conic: -0.26,
                n_before: 1.0,
                n_after: 1.376,
            },
            {
                type: "aspherical",
                name: "cornea_posterior",
                z: 0.55,
                radius: 6.5,
                conic: 0.0,
                n_before: 1.376,
                n_after: 1.336,
            },
            {
                type: "aspherical",
                name: "lens_anterior",
                z: 0.55 + 3.05,
                radius: 10.2,
                conic: -3.13,
                n_before: 1.336,
                n_after: 1.42,
            },
            {
                type: "aspherical",
                name: "lens_posterior",
                z: 0.55 + 3.05 + 4.0,
                radius: -6,
                conic: -1,
                n_before: 1.42,
                n_after: 1.336,
            },
            {
                type: "spherical-image",
                name: "retina",
                radius: -12, // mm (대략적인 망막 곡률)
                z: 24.04 // 중심 위치
            }
        ],
    };

    /**
     * Sturm 계산 전용 클래스입니다.
     * - traced ray 집합에서 z-scan slice를 생성하고
     * - 평탄도/최소타원/근사중심을 계산해 분석 결과를 반환합니다.
     */
    class Sturm {
        constructor() {
            this.lastResult = null;
            this.lineOrder = ["g", "F", "e", "d", "C", "r"];
        }
        calculate(rays, effectiveCylinderD) {
            const zRange = this.zRangeFromRays(rays);
            const sturmSlices = this.collectSturmSlices(rays, zRange, DEFAULT_STURM_STEP_MM);
            const groupedByLine = this.groupByFraunhoferLine(rays);
            const sturmInfo = groupedByLine.map((group) => {
                const slices = this.collectSturmSlices(group.rays, zRange, DEFAULT_STURM_STEP_MM);
                const analysis = this.analyzeSturmSlices(slices, effectiveCylinderD);
                return {
                    line: group.line,
                    wavelength_nm: group.wavelength_nm,
                    color: group.color,
                    ray_count: group.rays.length,
                    ...analysis,
                };
            });
            const result = {
                slices_info: {
                    count: sturmSlices.length,
                    slices: sturmSlices,
                },
                sturm_info: sturmInfo,
            };
            this.lastResult = result;
            return result;
        }
        /**
         * 마지막 Sturm 계산 결과를 반환합니다.
         */
        getLastResult() {
            return this.lastResult;
        }
        getRayPoints(ray) {
            const points = ray.points;
            return Array.isArray(points) ? points : [];
        }
        sampleRayPointAtZ(ray, z) {
            const points = this.getRayPoints(ray);
            for (let i = 0; i < points.length - 1; i += 1) {
                const a = points[i];
                const b = points[i + 1];
                if ((a.z <= z && z <= b.z) || (b.z <= z && z <= a.z)) {
                    const dz = b.z - a.z;
                    if (Math.abs(dz) < 1e-10)
                        return null;
                    return a.clone().lerp(b, (z - a.z) / dz);
                }
            }
            return null;
        }
        zRangeFromRays(rays) {
            let zMin = Number.POSITIVE_INFINITY;
            let zMax = Number.NEGATIVE_INFINITY;
            for (const ray of rays ?? []) {
                for (const point of this.getRayPoints(ray)) {
                    zMin = Math.min(zMin, point.z);
                    zMax = Math.max(zMax, point.z);
                }
            }
            if (!Number.isFinite(zMin) || !Number.isFinite(zMax) || zMax <= zMin)
                return null;
            return { zMin, zMax };
        }
        secondMomentProfileAtZ(rays, z) {
            const points = [];
            for (const ray of rays) {
                const point = this.sampleRayPointAtZ(ray, z);
                if (point)
                    points.push(point);
            }
            if (points.length < 4)
                return null;
            let cx = 0;
            let cy = 0;
            for (const p of points) {
                cx += p.x;
                cy += p.y;
            }
            cx /= points.length;
            cy /= points.length;
            let sxx = 0;
            let syy = 0;
            let sxy = 0;
            for (const p of points) {
                const dx = p.x - cx;
                const dy = p.y - cy;
                sxx += dx * dx;
                syy += dy * dy;
                sxy += dx * dy;
            }
            sxx /= points.length;
            syy /= points.length;
            sxy /= points.length;
            const trace = sxx + syy;
            const halfDiff = (sxx - syy) / 2;
            const root = Math.sqrt(Math.max(0, halfDiff * halfDiff + sxy * sxy));
            const lambdaMajor = Math.max(0, trace / 2 + root);
            const lambdaMinor = Math.max(0, trace / 2 - root);
            const thetaRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);
            const angleMajorDeg = ((thetaRad * 180) / Math.PI + 360) % 180;
            return {
                at: { x: cx, y: cy, z },
                wMajor: Math.sqrt(lambdaMajor),
                wMinor: Math.sqrt(lambdaMinor),
                angleMajorDeg,
                angleMinorDeg: (angleMajorDeg + 90) % 180,
            };
        }
        collectSturmSlices(rays, zRange, stepMm) {
            if (!zRange)
                return [];
            const out = [];
            for (let z = zRange.zMin; z <= zRange.zMax; z += stepMm) {
                const profile = this.secondMomentProfileAtZ(rays, z);
                if (!profile)
                    continue;
                out.push({
                    z,
                    ratio: profile.wMinor / Math.max(profile.wMajor, 1e-9),
                    size: Math.hypot(profile.wMajor, profile.wMinor),
                    profile,
                });
            }
            return out;
        }
        axisDiffDeg(a, b) {
            const d = Math.abs((((a - b) % 180) + 180) % 180);
            return Math.min(d, 180 - d);
        }
        buildApproxCenter(flattestTop2, smallestEllipse, preferTop2Mid) {
            if (flattestTop2.length <= 0)
                return null;
            if (preferTop2Mid && flattestTop2.length >= 2) {
                const first = flattestTop2[0];
                const second = flattestTop2[1];
                return {
                    x: (first.profile.at.x + second.profile.at.x) / 2,
                    y: (first.profile.at.y + second.profile.at.y) / 2,
                    z: (first.z + second.z) / 2,
                    mode: "top2-mid",
                };
            }
            if (smallestEllipse) {
                return {
                    x: smallestEllipse.profile.at.x,
                    y: smallestEllipse.profile.at.y,
                    z: smallestEllipse.z,
                    mode: "min-size",
                };
            }
            const first = flattestTop2[0];
            return { x: first.profile.at.x, y: first.profile.at.y, z: first.z, mode: "top1-flat" };
        }
        groupByFraunhoferLine(rays) {
            const groups = new Map();
            for (const ray of rays) {
                const line = ray.getFraunhoferLine();
                const wavelength = ray.getWavelengthNm();
                const color = Number(ray.displayColor);
                if (!groups.has(line)) {
                    groups.set(line, {
                        line,
                        wavelength_nm: wavelength,
                        color: Number.isFinite(color) ? color : null,
                        rays: [],
                    });
                }
                const group = groups.get(line);
                if (group)
                    group.rays.push(ray);
            }
            return [...groups.values()].sort((a, b) => this.lineOrder.indexOf(a.line) - this.lineOrder.indexOf(b.line));
        }
        analyzeSturmSlices(sturmSlices, effectiveCylinderD) {
            const top2MinGapMm = DEFAULT_STURM_TOP2_MIN_GAP_MM;
            const top2MinAngleGapDeg = DEFAULT_STURM_TOP2_MIN_ANGLE_GAP_DEG;
            const effectiveCylinderThresholdD = DEFAULT_EFFECTIVE_CYLINDER_THRESHOLD_D;
            const preferTop2Mid = effectiveCylinderD >= effectiveCylinderThresholdD;
            const sortedByFlatness = [...sturmSlices].sort((a, b) => a.ratio - b.ratio);
            let flattestTop2 = [];
            if (sortedByFlatness.length > 0) {
                const first = sortedByFlatness[0];
                const second = sortedByFlatness.find((candidate) => (Math.abs(candidate.z - first.z) >= top2MinGapMm
                    && this.axisDiffDeg(candidate.profile.angleMajorDeg, first.profile.angleMajorDeg) >= top2MinAngleGapDeg));
                flattestTop2 = second ? [first, second] : [first];
            }
            let smallestEllipse = null;
            for (const slice of sturmSlices) {
                if (!smallestEllipse || slice.size < smallestEllipse.size)
                    smallestEllipse = slice;
            }
            const approxCenter = this.buildApproxCenter(flattestTop2, smallestEllipse, preferTop2Mid);
            const anterior = flattestTop2[0] ?? null;
            const posterior = preferTop2Mid ? (flattestTop2[1] ?? null) : null;
            return {
                has_astigmatism: preferTop2Mid,
                method: preferTop2Mid ? "sturm-interval-midpoint" : "minimum-ellipse",
                anterior,
                posterior,
                approx_center: approxCenter,
            };
        }
    }

    class ApertureStopSurface extends Surface {
        constructor(props) {
            super({
                type: "aperture_stop",
                name: props.name,
                position: props.position,
                tilt: props.tilt,
            });
            this.shape = props.shape;
            this.radius = Math.max(0, Number(props.radius ?? 0));
            this.width = Math.max(0, Number(props.width ?? 0));
            this.height = Math.max(0, Number(props.height ?? 0));
        }
        worldQuaternion() {
            const tiltXRad = (this.tilt.x * Math.PI) / 180;
            const tiltYRad = (this.tilt.y * Math.PI) / 180;
            return new Quaternion().setFromEuler(new Euler(tiltXRad, tiltYRad, 0, "XYZ"));
        }
        localPointFromWorld(worldPoint) {
            const inverse = this.worldQuaternion().invert();
            return worldPoint
                .clone()
                .sub(this.position)
                .applyQuaternion(inverse);
        }
        surfaceNormalWorld() {
            return new Vector3(0, 0, 1).applyQuaternion(this.worldQuaternion()).normalize();
        }
        intersectForward(origin, direction) {
            const normal = this.surfaceNormalWorld();
            const denom = normal.dot(direction);
            if (Math.abs(denom) < EPSILON)
                return null;
            const t = normal.dot(this.position.clone().sub(origin)) / denom;
            if (!Number.isFinite(t) || t <= 1e-6)
                return null;
            return origin.clone().addScaledVector(direction, t);
        }
        isInsideAperture(hitPointWorld) {
            const local = this.localPointFromWorld(hitPointWorld);
            if (this.shape === "circle") {
                if (this.radius <= 0)
                    return false;
                return Math.hypot(local.x, local.y) <= this.radius + 1e-9;
            }
            if (this.width <= 0 || this.height <= 0)
                return false;
            return (Math.abs(local.x) <= (this.width / 2) + 1e-9
                && Math.abs(local.y) <= (this.height / 2) + 1e-9);
        }
        incident(ray) {
            const origin = ray.endPoint();
            const direction = ray.getDirection().normalize();
            const hitPoint = this.intersectForward(origin, direction);
            if (!hitPoint)
                return null;
            if (!this.isInsideAperture(hitPoint))
                return null;
            this.incidentRays.push(ray.clone());
            return hitPoint;
        }
        refract(ray) {
            const hitPoint = this.incident(ray);
            if (!hitPoint)
                return null;
            const direction = ray.getDirection().normalize();
            const passedRay = ray.clone();
            passedRay.appendPoint(hitPoint);
            passedRay.continueFrom(hitPoint.clone().addScaledVector(direction, RAY_SURFACE_ESCAPE_MM), direction);
            this.refractedRays.push(passedRay.clone());
            return passedRay;
        }
    }

    class ToricSurface extends Surface {
        constructor(props) {
            super({ type: "toric", name: props.name, position: props.position, tilt: props.tilt });
            this.r_axis = 0;
            this.r_perp = 0;
            this.n_before = 1.0;
            this.n_after = 1.0;
            const { r_axis, r_perp, n_before = 1.0, n_after = 1.0 } = props;
            this.r_axis = r_axis;
            this.r_perp = r_perp;
            this.n_before = normalizeRefractiveIndexSpec(n_before);
            this.n_after = normalizeRefractiveIndexSpec(n_after);
        }
        refractiveIndicesForRay(ray) {
            const line = ray.getFraunhoferLine();
            return {
                nBefore: resolveRefractiveIndex(this.n_before, line),
                nAfter: resolveRefractiveIndex(this.n_after, line),
            };
        }
        /**
         * Toric 면의 축(meridian) 회전을 위해 사용하는 삼각함수 값입니다.
         * 이 구현에서는 `tilt.y`를 축 각도(도 단위)로 사용합니다.
         */
        axisTrig() {
            const rad = (this.tilt.y * Math.PI) / 180;
            return { c: Math.cos(rad), s: Math.sin(rad) };
        }
        /**
         * 월드 좌표계 (x, y)를 토릭 로컬 좌표계 (u, v)로 변환합니다.
         * - u: 축 방향 meridian
         * - v: 축에 수직인 meridian
         */
        toLocalUV(x, y) {
            const { c, s } = this.axisTrig();
            return {
                u: c * x + s * y,
                v: -s * x + c * y,
            };
        }
        /**
         * 로컬 좌표계에서 계산한 sag 미분(dz/du, dz/dv)을
         * 월드 좌표계의 기울기(dz/dx, dz/dy)로 다시 매핑합니다.
         */
        localDerivativesToWorld(dZdu, dZdv) {
            const { c, s } = this.axisTrig();
            return {
                dzdx: dZdu * c - dZdv * s,
                dzdy: dZdu * s + dZdv * c,
            };
        }
        /**
         * 반경으로부터 곡률(1/R)을 계산합니다.
         * - 반경이 너무 크거나 무한대면 평면으로 간주하여 0 반환
         * - 반경이 0에 너무 가까우면 비정상 값으로 NaN 반환
         */
        curvature(radius) {
            if (!Number.isFinite(radius) || Math.abs(radius) > 1e12)
                return 0;
            if (Math.abs(radius) < EPSILON)
                return Number.NaN;
            return 1 / radius;
        }
        /**
         * 주어진 XY에서 토릭면의 기하정보를 계산합니다.
         * - sag: 꼭지점 대비 z 높이
         * - dzdx/dzdy: 면 기울기
         * - normal: 2번째 매질 방향을 만들 때 사용할 기본 법선
         */
        geometryAtXY(x, y) {
            const { u, v } = this.toLocalUV(x, y);
            const cu = this.curvature(this.r_axis);
            const cv = this.curvature(this.r_perp);
            if (!Number.isFinite(cu) || !Number.isFinite(cv))
                return null;
            // biconic(conic=0) sag 식
            const a = cu * u * u + cv * v * v;
            const b = 1 - cu * cu * u * u - cv * cv * v * v;
            if (b < -1e-6)
                return null; // 루트 내부가 음수면 정의역 밖
            const sqrtB = Math.sqrt(Math.max(0, b));
            const den = 1 + sqrtB;
            if (Math.abs(den) < EPSILON || Math.abs(sqrtB) < EPSILON)
                return null;
            const sag = a / den;
            // sag 미분 계산
            const dAdu = 2 * cu * u;
            const dAdv = 2 * cv * v;
            const dSqrtBdu = (-(cu * cu) * u) / sqrtB;
            const dSqrtBdv = (-(cv * cv) * v) / sqrtB;
            const denSq = den * den;
            const dZdu = (dAdu * den - a * dSqrtBdu) / denSq;
            const dZdv = (dAdv * den - a * dSqrtBdv) / denSq;
            const { dzdx, dzdy } = this.localDerivativesToWorld(dZdu, dZdv);
            const normal = new Vector3(-dzdx, -dzdy, 1).normalize();
            return { sag, dzdx, dzdy, normal };
        }
        incident(ray) {
            const origin = ray.endPoint();
            const direction = ray.getDirection().normalize();
            // 시작점이 이미 표면 위라면 재계산 없이 바로 반환합니다.
            const geometryAtOrigin = this.geometryAtXY(origin.x, origin.y);
            if (geometryAtOrigin) {
                const f0 = origin.z - (this.position.z + geometryAtOrigin.sag);
                if (Math.abs(f0) <= TORIC_ON_SURFACE_TOL_MM) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
                // 동일 z 근처의 연속 표면에서 앞면이 origin을 약간 밀어냈을 때를 허용합니다.
                if (f0 > 0
                    && f0 <= TORIC_COINCIDENT_SURFACE_TOL_MM
                    && direction.z > 0
                    && this.position.z <= origin.z + TORIC_COINCIDENT_SURFACE_TOL_MM) {
                    this.incidentRays.push(ray.clone());
                    return origin.clone();
                }
            }
            // z-plane 기준 초기 seed 이후 뉴턴법으로 교점 t를 수렴시킵니다.
            let t = Math.max(TORIC_MIN_T_MM, this.position.z - origin.z);
            for (let i = 0; i < TORIC_MAX_ITERS; i++) {
                const p = origin.clone().addScaledVector(direction, t);
                const geometry = this.geometryAtXY(p.x, p.y);
                if (!geometry)
                    return null;
                const f = p.z - (this.position.z + geometry.sag);
                const df = direction.z - geometry.dzdx * direction.x - geometry.dzdy * direction.y;
                if (!Number.isFinite(df) || Math.abs(df) < EPSILON)
                    return null;
                const dt = f / df;
                t -= dt;
                if (!Number.isFinite(t) || t < TORIC_MIN_T_MM)
                    return null;
                if (Math.abs(dt) < 1e-8) {
                    const hitPoint = origin.clone().addScaledVector(direction, t);
                    this.incidentRays.push(ray.clone());
                    return hitPoint;
                }
            }
            return null;
        }
        refract(ray) {
            const hitPoint = this.incident(ray);
            if (!hitPoint)
                return null;
            const geometry = this.geometryAtXY(hitPoint.x, hitPoint.y);
            if (!geometry)
                return null;
            // 스넬 굴절 벡터 계산
            const incidentDir = ray.getDirection().normalize();
            const normalIntoSecond = geometry.normal.clone();
            // 법선을 입사방향과 같은 반공간으로 맞춰 2번째 매질 방향으로 정렬
            if (normalIntoSecond.dot(incidentDir) < 0) {
                normalIntoSecond.multiplyScalar(-1);
            }
            const cos1 = Math.max(-1, Math.min(1, normalIntoSecond.dot(incidentDir)));
            const sin1Sq = Math.max(0, 1 - cos1 * cos1);
            const { nBefore, nAfter } = this.refractiveIndicesForRay(ray);
            const sin2 = (nBefore / nAfter) * Math.sqrt(sin1Sq);
            // 전반사(TIR)
            if (sin2 > 1 + 1e-10)
                return null;
            const cos2 = Math.sqrt(Math.max(0, 1 - sin2 * sin2));
            const tangent = incidentDir.clone().sub(normalIntoSecond.clone().multiplyScalar(cos1));
            const outDirection = tangent.lengthSq() < 1e-12
                ? incidentDir.clone()
                : normalIntoSecond
                    .clone()
                    .multiplyScalar(cos2)
                    .add(tangent.normalize().multiplyScalar(sin2))
                    .normalize();
            const refractedRay = ray.clone();
            refractedRay.appendPoint(hitPoint);
            refractedRay.continueFrom(hitPoint.clone().addScaledVector(outDirection, RAY_SURFACE_ESCAPE_MM), outDirection);
            this.refractedRays.push(refractedRay.clone());
            return refractedRay;
        }
    }

    class STSurface extends Surface {
        constructor(props) {
            super({ type: "compound", name: props.name, position: props.position, tilt: props.tilt });
            this.s = 0;
            this.c = 0;
            this.ax = 0;
            this.n_before = 1.0;
            this.n = 1.0;
            this.n_after = 1.0;
            this.thickness = 0;
            this.frontRadiusMm = Number.POSITIVE_INFINITY;
            this.backRadiusPerpMm = Number.POSITIVE_INFINITY;
            const { s, c, ax, n_before = 1.0, n = 1.0, n_after = n_before, referencePoint, thickness = ST_DEFAULT_THICKNESS_MM, } = props;
            this.s = s;
            this.c = c;
            this.ax = ax;
            this.n_before = normalizeRefractiveIndexSpec(n_before);
            this.n = normalizeRefractiveIndexSpec(n);
            this.n_after = normalizeRefractiveIndexSpec(n_after);
            this.frontRadiusMm = this.radiusFromPower(this.s, this.refractiveIndexAtD(this.n_before), this.refractiveIndexAtD(this.n));
            this.backRadiusPerpMm = this.radiusFromPower(this.c, this.refractiveIndexAtD(this.n), this.refractiveIndexAtD(this.n_after));
            const requestedThickness = Math.max(0, thickness);
            this.thickness = requestedThickness === 0
                ? this.optimizeThickness(0)
                : requestedThickness;
            this.position.z = this.optimizeBackZFromReference(this.position.z, referencePoint?.z, this.thickness);
            // 복합면은 "전면 구면 + 후면 토릭"으로 구성됩니다.
            this.front = this.buildFrontSurface();
            this.back = this.buildBackSurface();
        }
        /**
         * 디옵터(D)로부터 반경(mm)을 계산합니다.
         *
         * power(D) = (n2 - n1) / R(m)
         *   -> R(mm) = 1000 * (n2 - n1) / power(D)
         *
         * 굴절력이 사실상 0이면 평면으로 간주하기 위해 +Infinity를 반환합니다.
         */
        radiusFromPower(powerD, nBefore, nAfter) {
            if (!Number.isFinite(powerD)
                || !Number.isFinite(nBefore)
                || !Number.isFinite(nAfter)) {
                return Number.NaN;
            }
            if (Math.abs(powerD) < ST_POWER_EPS_D)
                return Number.POSITIVE_INFINITY;
            return (1000 * (nAfter - nBefore)) / powerD;
        }
        refractiveIndexAtD(spec) {
            return resolveRefractiveIndex(spec, "d");
        }
        /**
         * ST 전면: 구면(sphere) 성분
         */
        buildFrontSurface() {
            const frontZ = this.position.z + this.thickness;
            const hasBack = Math.abs(this.c) >= ST_POWER_EPS_D;
            const frontNBefore = hasBack ? this.n : this.n_before;
            const frontNAfter = hasBack ? this.n_after : this.n;
            const frontProps = {
                type: "spherical",
                name: `${this.name}_front`,
                position: { x: this.position.x, y: this.position.y, z: frontZ },
                tilt: { x: this.tilt.x, y: this.tilt.y },
                r: this.frontRadiusMm,
                n_before: frontNBefore,
                n_after: frontNAfter,
            };
            return new SphericalSurface(frontProps);
        }
        /**
         * ST 후면: cylinder 성분이 존재할 때만 토릭면을 생성합니다.
         * cylinder가 0에 매우 가까우면 후면은 생략됩니다.
         */
        buildBackSurface() {
            if (Math.abs(this.c) < ST_POWER_EPS_D)
                return null;
            const backProps = {
                type: "toric",
                name: `${this.name}_back`,
                position: {
                    x: this.position.x,
                    y: this.position.y,
                    z: this.position.z,
                },
                tilt: { x: this.tilt.x, y: this.tilt.y + this.ax },
                r_axis: Number.POSITIVE_INFINITY,
                r_perp: this.backRadiusPerpMm,
                n_before: this.n_before,
                n_after: this.n,
            };
            return new ToricSurface(backProps);
        }
        applyChromaticIndicesToSubSurfaces(ray) {
            const line = ray.getFraunhoferLine();
            const nBefore = resolveRefractiveIndex(this.n_before, line);
            const n = resolveRefractiveIndex(this.n, line);
            const nAfter = resolveRefractiveIndex(this.n_after, line);
            const frontState = this.front;
            if (this.back) {
                frontState.n_before = n;
                frontState.n_after = nAfter;
                const backState = this.back;
                backState.n_before = nBefore;
                backState.n_after = n;
                return;
            }
            frontState.n_before = nBefore;
            frontState.n_after = n;
        }
        /**
         * 전면/후면 곡면의 z 교차(후면이 전면을 관통) 방지를 위해
         * 샘플링 영역에서 필요한 최소 중심두께를 계산합니다.
         */
        optimizeThickness(requestedThickness) {
            if (Math.abs(this.c) < ST_POWER_EPS_D)
                return requestedThickness;
            const sampleRadius = this.samplingRadiusMm();
            if (!Number.isFinite(sampleRadius) || sampleRadius <= 0)
                return requestedThickness;
            const samplesPerAxis = 49;
            let requiredThickness = requestedThickness;
            const safetyMargin = Math.max(0.05, 2 * RAY_SURFACE_ESCAPE_MM);
            for (let iy = 0; iy < samplesPerAxis; iy++) {
                const y = -sampleRadius + (2 * sampleRadius * iy) / (samplesPerAxis - 1);
                for (let ix = 0; ix < samplesPerAxis; ix++) {
                    const x = -sampleRadius + (2 * sampleRadius * ix) / (samplesPerAxis - 1);
                    if ((x * x + y * y) > sampleRadius * sampleRadius)
                        continue;
                    const frontSag = this.frontSagAtXY(x, y);
                    const backSag = this.backSagAtXY(x, y);
                    if (!Number.isFinite(frontSag) || !Number.isFinite(backSag))
                        continue;
                    const localRequired = (frontSag - backSag) + safetyMargin;
                    if (localRequired > requiredThickness)
                        requiredThickness = localRequired;
                }
            }
            return Math.max(0, requiredThickness);
        }
        /**
         * 기준점(referencePoint.z)으로부터 후면(back vertex)까지의 최소 간격을 확보합니다.
         * - 기준점과 반대 방향으로 현재 후면이 놓인 쪽(sign)을 유지합니다.
         * - 최소 간격은 "후면-전면 거리(thickness) + 안전여유"입니다.
         */
        optimizeBackZFromReference(backZ, referenceZ, thicknessMm = this.thickness) {
            if (!Number.isFinite(referenceZ))
                return backZ;
            const safetyMargin = Math.max(0.05, 2 * RAY_SURFACE_ESCAPE_MM);
            const minGap = Math.max(EYE_ST_SURFACE_OFFSET_MM, Math.max(0, thicknessMm) + safetyMargin);
            const delta = backZ - referenceZ;
            const side = Math.abs(delta) < 1e-12 ? -1 : Math.sign(delta);
            const currentGap = Math.abs(delta);
            if (currentGap >= minGap)
                return backZ;
            return referenceZ + side * minGap;
        }
        samplingRadiusMm() {
            const defaultRadius = 12;
            const finiteRadii = [this.frontRadiusMm, this.backRadiusPerpMm]
                .filter((r) => Number.isFinite(r) && Math.abs(r) > 1e-6)
                .map((r) => Math.abs(r));
            if (!finiteRadii.length)
                return defaultRadius;
            return Math.max(1.0, Math.min(defaultRadius, 0.98 * Math.min(...finiteRadii)));
        }
        /**
         * 구면 전면의 꼭지점 기준 sag(mm)
         */
        frontSagAtXY(x, y) {
            const rhoSq = x * x + y * y;
            const r = this.frontRadiusMm;
            if (!Number.isFinite(r) || Math.abs(r) > 1e12)
                return 0;
            const rr = r * r;
            if (rhoSq > rr)
                return Number.NaN;
            const root = Math.sqrt(Math.max(0, rr - rhoSq));
            return r > 0 ? r - root : r + root;
        }
        /**
         * 토릭 후면의 꼭지점 기준 sag(mm)
         */
        backSagAtXY(x, y) {
            const axisRad = (this.tilt.y + this.ax) * Math.PI / 180;
            const cAxis = Math.cos(axisRad);
            const sAxis = Math.sin(axisRad);
            const u = cAxis * x + sAxis * y;
            const v = -sAxis * x + cAxis * y;
            const cu = 0; // r_axis = Infinity
            const cv = (!Number.isFinite(this.backRadiusPerpMm) || Math.abs(this.backRadiusPerpMm) > 1e12)
                ? 0
                : 1 / this.backRadiusPerpMm;
            const a = cu * u * u + cv * v * v;
            const b = 1 - cu * cu * u * u - cv * cv * v * v;
            if (b < 0)
                return Number.NaN;
            const den = 1 + Math.sqrt(Math.max(0, b));
            if (Math.abs(den) < 1e-12)
                return Number.NaN;
            return a / den;
        }
        refract(ray) {
            this.applyChromaticIndicesToSubSurfaces(ray);
            // 원통 성분이 없으면 단일(구면)면으로 처리합니다.
            if (!this.back) {
                const single = this.front.refract(ray);
                if (!single)
                    return null;
                this.refractedRays.push(single.clone());
                return single;
            }
            // 후면 기준 배치: 후면(토릭) -> 전면(구면)
            const afterBack = this.back.refract(ray);
            if (!afterBack)
                return null;
            const afterFront = this.front.refract(afterBack);
            if (!afterFront)
                return null;
            this.refractedRays.push(afterFront.clone());
            return afterFront;
        }
        incident(ray) {
            // 복합면의 첫 hit는 항상 후면 기준(토릭 우선)으로 결정됩니다.
            const primary = this.back ?? this.front;
            const hitPoint = primary.incident(ray);
            if (!hitPoint)
                return null;
            this.incidentRays.push(ray.clone());
            return hitPoint;
        }
        getOptimizedThicknessMm() {
            return this.thickness;
        }
    }

    const TABOToDeg = (TABOAngle) => {
        const t = Number(TABOAngle);
        if (!Number.isFinite(t))
            return 0;
        return (((180 - t) % 180) + 180) % 180;
    };

    const DegToTABO = (degree) => {
        const d = Number(degree);
        if (!Number.isFinite(d))
            return 0;
        return (((180 - d) % 180) + 180) % 180;
    };

    /**
     * legacy simulator.js를 TypeScript로 옮긴 핵심 시뮬레이터입니다.
     * - 광원 광선을 생성하고
     * - 표면들을 순서대로 통과시키며 굴절을 계산한 뒤
     * - 망막 대응쌍, Sturm 분석, 왜곡(affine) 분석까지 제공합니다.
     */
    class SCAXEngine {
        constructor(props = {}) {
            this.tracedRays = [];
            this.lastSturmGapAnalysis = null;
            this.lastAffineAnalysis = null;
            this.sturm = new Sturm();
            this.affine = new Affine();
            this.configure(props);
        }
        /**
         * 생성자와 동일한 기본값 규칙으로 광학 설정을 다시 적용합니다.
         * 생략한 최상위 필드는 매번 기본값으로 돌아갑니다(이전 값과 병합하지 않음).
         */
        update(props = {}) {
            this.configure(props);
        }
        configure(props = {}) {
            this.lastSturmGapAnalysis = null;
            this.lastAffineAnalysis = null;
            const { eyeModel = "gullstrand", eye = { s: 0, c: 0, ax: 0 }, lens = [], light_source = { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 }, pupil_type = "neutral", } = props;
            this.eyeModel = eyeModel;
            const normalizedEyeSphere = Number(eye?.s ?? 0) + (eyeModel === "gullstrand" ? -1 : 0);
            // eye 입력은 auto refractor(굴절오차) 기준이므로,
            // 광학면에 적용할 때는 보정렌즈 파워 관점으로 부호를 반전합니다.
            this.eyePower = {
                s: -normalizedEyeSphere,
                c: -Number(eye?.c ?? 0),
                ax: Number(eye?.ax ?? 0),
            };
            this.lensConfigs = (Array.isArray(lens) ? lens : []).map((spec) => ({
                s: Number(spec?.s ?? 0),
                c: Number(spec?.c ?? 0),
                ax: Number(spec?.ax ?? 0),
                position: {
                    x: Number(spec?.position?.x ?? 0),
                    y: Number(spec?.position?.y ?? 0),
                    z: Number(spec?.position?.z ?? SPECTACLE_VERTEX_DISTANCE_MM),
                },
                tilt: {
                    x: Number(spec?.tilt?.x ?? 0),
                    y: Number(spec?.tilt?.y ?? 0),
                },
            }));
            this.lensPowers = this.lensConfigs.map((spec) => ({
                s: Number(spec?.s ?? 0),
                c: Number(spec?.c ?? 0),
                ax: Number(spec?.ax ?? 0),
            }));
            this.pupilDiameterMm = Number(PUPIL_SIZE[pupil_type]);
            this.eyeModelParameter = eyeModel === "gullstrand" ? new GullstrandParameter() : new NavarroParameter();
            const eyeSt = new STSurface({
                type: "compound",
                name: "eye_st",
                position: { x: 0, y: 0, z: -EYE_ST_SURFACE_OFFSET_MM },
                referencePoint: { x: 0, y: 0, z: 0 },
                tilt: { x: 0, y: 0 },
                s: this.eyePower.s,
                c: this.eyePower.c,
                ax: this.eyePower.ax,
                n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
                n: FRAUNHOFER_REFRACTIVE_INDICES.cornea,
                n_after: FRAUNHOFER_REFRACTIVE_INDICES.aqueous,
            });
            this.surfaces = [eyeSt, ...this.eyeModelParameter.createSurface()];
            this.hasPupilStop = false;
            if (Number.isFinite(this.pupilDiameterMm) && this.pupilDiameterMm > 0) {
                const pupilStop = new ApertureStopSurface({
                    type: "aperture_stop",
                    name: "pupil_stop",
                    shape: "circle",
                    radius: this.pupilDiameterMm / 2,
                    // eye_st(눈 굴절력 surface)의 첫 굴절면(back vertex) 바로 앞에서 차단/통과를 판정합니다.
                    position: {
                        x: 0,
                        y: 0,
                        z: -EYE_ST_SURFACE_OFFSET_MM - (2 * RAY_SURFACE_ESCAPE_MM),
                    },
                    tilt: { x: 0, y: 0 },
                });
                this.surfaces = [pupilStop, ...this.surfaces];
                this.hasPupilStop = true;
            }
            this.lens = this.lensConfigs.map((spec, index) => new STSurface({
                type: "compound",
                name: `lens_st_${index + 1}`,
                position: { x: spec.position.x, y: spec.position.y, z: spec.position.z },
                tilt: { x: spec.tilt.x, y: spec.tilt.y },
                // Spectacle ST rule:
                // 1) back surface is fixed at vertex distance(position.z)
                // 2) back-front gap is optimized (thickness=0 => auto)
                thickness: 0,
                s: Number(spec?.s ?? 0),
                c: Number(spec?.c ?? 0),
                ax: Number(spec?.ax ?? 0),
                n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
                n: FRAUNHOFER_REFRACTIVE_INDICES.crown_glass,
                n_after: FRAUNHOFER_REFRACTIVE_INDICES.air,
            }));
            this.light_source = light_source.type === "radial"
                ? new RadialLightSource(light_source)
                : light_source.type === "grid_rg"
                    ? new GridRGLightSource(light_source)
                    : new GridLightSource(light_source);
            this.retinaZMm = this.findRetinaZFromSurfaces();
        }
        /**
         * 기본 시뮬레이션 진입점입니다.
         * includeSturmData 값과 무관하게 확장 분석(Sturm/retinaPairs)을 항상 포함합니다.
         */
        simulate() {
            const tracedRays = this.rayTracing();
            return {
                traced_rays: tracedRays,
                induced_astigmatism: this.calculateInducedAstigmatism(this.eyePower, this.lensPowers),
            };
        }
        /**
         * 1) Ray tracing 전용 함수
         * 광원에서 시작한 광선을 표면 순서대로 굴절시켜 최종 광선 집합을 반환합니다.
         */
        rayTracing() {
            // 안경 렌즈(lens)와 안구 표면(eye model)을 하나의 광학 경로로 합쳐 순차 추적합니다.
            const surfaces = [...this.lens, ...this.surfaces].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
            const sourceRays = this.hasPupilStop
                ? this.light_source.emitRays()
                : this.light_source.emitRays().filter((ray) => this.isRayInsidePupil(ray));
            const traced = [];
            for (const sourceRay of sourceRays) {
                let activeRay = sourceRay.clone();
                let valid = true;
                for (const surface of surfaces) {
                    const nextRay = surface.refract(activeRay);
                    if (!(nextRay instanceof Ray)) {
                        valid = false;
                        break;
                    }
                    activeRay = nextRay;
                }
                if (valid) {
                    traced.push(activeRay);
                }
                else if (this.getRayPoints(activeRay).length >= 2) {
                    // 일부 면에서 실패하더라도 실패 지점까지의 실제 광로는 시각화에 남깁니다.
                    traced.push(activeRay);
                }
            }
            this.tracedRays = traced;
            return traced;
        }
        /**
         * 2) Sturm calculation 전용 함수
         * traced ray 집합에서 z-scan 기반 Sturm 슬라이스/근사 중심을 계산합니다.
         */
        sturmCalculation(rays = this.tracedRays) {
            this.lastSturmGapAnalysis = this.sturm.calculate(rays, this.effectiveCylinderFromOpticSurfaces());
            return this.lastSturmGapAnalysis;
        }
        /**
         * 3) Affine 왜곡 추정 전용 함수
         * 광선 대응쌍(sx,sy)->(tx,ty)에 대해 최소자승 2D affine을 적합합니다.
         */
        estimateAffineDistortion(pairs) {
            const inputPairs = Array.isArray(pairs) ? pairs : [];
            this.lastAffineAnalysis = this.affine.estimate(inputPairs);
            return this.lastAffineAnalysis;
        }
        /**
         * 기존 API 호환용 별칭입니다.
         */
        affine2d(pairs) {
            return this.estimateAffineDistortion(pairs);
        }
        getSturmGapAnalysis() {
            return this.lastSturmGapAnalysis;
        }
        getAffineAnalysis() {
            return this.lastAffineAnalysis;
        }
        /**
         * 눈 도수와 안경 도수를 합성했을 때의 유발난시를 계산합니다.
         * - 입력 축(ax)은 TABO(deg) 기준으로 해석합니다.
         * - 결과는 { induced, eye, lens }를 반환합니다.
         * - 각 항목은 { d, tabo_deg } 형태이며, 난시가 없으면 null을 반환합니다.
         */
        calculateInducedAstigmatism(eye, lens) {
            const lensList = Array.isArray(lens) ? lens : [lens];
            const toAstigmatism = (powers) => {
                let j0 = 0;
                let j45 = 0;
                for (const power of powers) {
                    const cylinder = Number(power?.c ?? 0);
                    const axisTABO = Number(power?.ax ?? 0);
                    if (!Number.isFinite(cylinder) || !Number.isFinite(axisTABO) || Math.abs(cylinder) < 1e-12)
                        continue;
                    const axisDeg = DegToTABO(axisTABO);
                    const rad = (2 * axisDeg * Math.PI) / 180;
                    const scale = -cylinder / 2;
                    j0 += scale * Math.cos(rad);
                    j45 += scale * Math.sin(rad);
                }
                const d = 2 * Math.hypot(j0, j45);
                if (!Number.isFinite(d) || d < 1e-9)
                    return null;
                const axisDeg = (((0.5 * Math.atan2(j45, j0) * 180) / Math.PI) % 180 + 180) % 180;
                return {
                    d,
                    tabo_deg: TABOToDeg(axisDeg),
                };
            };
            return {
                induced: toAstigmatism([eye, ...lensList]),
                eye: toAstigmatism([eye]),
                lens: toAstigmatism(lensList),
            };
        }
        surfaceOrderZ(surface) {
            const z = Number(this.readSurfacePosition(surface)?.z);
            return Number.isFinite(z) ? z : 0;
        }
        readSurfaceName(surface) {
            return surface.name;
        }
        readSurfacePosition(surface) {
            return surface.position;
        }
        getRayPoints(ray) {
            const points = ray.points;
            return Array.isArray(points) ? points : [];
        }
        findRetinaZFromSurfaces() {
            const retinaSurface = this.surfaces.find((surface) => this.readSurfaceName(surface) === "retina");
            const retinaZ = Number(this.readSurfacePosition(retinaSurface)?.z);
            return Number.isFinite(retinaZ) ? retinaZ : null;
        }
        isRayInsidePupil(ray) {
            const diameter = this.pupilDiameterMm;
            if (!Number.isFinite(diameter) || diameter <= 0)
                return true;
            const radius = diameter / 2;
            const points = this.getRayPoints(ray);
            const origin = points[0];
            if (!origin)
                return false;
            return Math.hypot(origin.x, origin.y) <= radius + 1e-6;
        }
        powerVectorFromCylinder(cylinderD, axisDeg) {
            const c = Number(cylinderD);
            const ax = ((Number(axisDeg) % 180) + 180) % 180;
            if (!Number.isFinite(c))
                return { j0: 0, j45: 0 };
            const rad = (2 * ax * Math.PI) / 180;
            const scale = -c / 2;
            return { j0: scale * Math.cos(rad), j45: scale * Math.sin(rad) };
        }
        effectiveCylinderFromOpticSurfaces() {
            let j0 = 0;
            let j45 = 0;
            for (const surface of [...this.lens, ...this.surfaces]) {
                const s = surface;
                const c = Number(s.c);
                const ax = Number(s.ax);
                if (!Number.isFinite(c) || Math.abs(c) < 1e-12 || !Number.isFinite(ax))
                    continue;
                const v = this.powerVectorFromCylinder(c, ax);
                j0 += v.j0;
                j45 += v.j45;
            }
            return 2 * Math.hypot(j0, j45);
        }
    }

    exports.Ray = Ray;
    exports.SCAXEngine = SCAXEngine;

}));
//# sourceMappingURL=scax-engine.umd.js.map
