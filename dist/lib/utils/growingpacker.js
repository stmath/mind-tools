"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.GrowingPacker = GrowingPacker;
// Derived from file here
// https://github.com/jsmarkus/node-bin-packing/blob/master/js/packer.growing.js
var MAX_DIMENSION = 9999999999999;
var FIRST_INDEX = 0;
var NO_WIDTH = 0;
function GrowingPacker(w, h) {
	this.init(w, h);
};

GrowingPacker.prototype = {

	init: function init(w, h) {
		this.maxWidth = w || MAX_DIMENSION;
		this.maxHeight = h || MAX_DIMENSION;
	},

	fit: function fit(blocks) {
		// eslint-disable-next-line one-var
		var n,
		    node,
		    block,
		    len = blocks.length;
		var w = len ? blocks[FIRST_INDEX].w : NO_WIDTH;
		var h = len ? blocks[FIRST_INDEX].h : NO_WIDTH;
		this.root = { x: 0, y: 0, w: w, h: h };
		for (n = FIRST_INDEX; n < len; n++) {
			block = blocks[n];
			node = this.findNode(this.root, block.w, block.h);
			if (node) {
				block.fit = this.splitNode(node, block.w, block.h);
			} else {
				block.fit = this.growNode(block.w, block.h);
			}
		}
	},

	findNode: function findNode(root, w, h) {
		if (root.used) {
			return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
		} else if (w <= root.w && h <= root.h) {
			return root;
		} else {
			return null;
		}
	},

	splitNode: function splitNode(node, w, h) {
		node.used = true;
		node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
		node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
		return node;
	},

	growNode: function growNode(w, h) {
		var canGrowDown = w <= this.root.w && this.root.h + h < this.maxHeight;
		var canGrowRight = h <= this.root.h && this.root.w + w < this.maxWidth;

		var shouldGrowRight = canGrowRight && this.root.h >= this.root.w + w; // attempt to keep square-ish by growing right when height is much greater than width
		var shouldGrowDown = canGrowDown && this.root.w >= this.root.h + h; // attempt to keep square-ish by growing down  when width  is much greater than height

		if (shouldGrowRight) {
			return this.growRight(w, h);
		} else if (shouldGrowDown) {
			return this.growDown(w, h);
		} else if (canGrowRight) {
			return this.growRight(w, h);
		} else if (canGrowDown) {
			return this.growDown(w, h);
		} else {
			return null;
		} // need to ensure sensible root starting size to avoid this happening
	},

	growRight: function growRight(w, h) {
		this.root = {
			used: true,
			x: 0,
			y: 0,
			w: this.root.w + w,
			h: this.root.h,
			down: this.root,
			right: { x: this.root.w, y: 0, w: w, h: this.root.h }
		};
		var node = this.findNode(this.root, w, h);
		if (node) {
			return this.splitNode(node, w, h);
		} else {
			return null;
		}
	},

	growDown: function growDown(w, h) {
		this.root = {
			used: true,
			x: 0,
			y: 0,
			w: this.root.w,
			h: this.root.h + h,
			down: { x: 0, y: this.root.h, w: this.root.w, h: h },
			right: this.root
		};
		var node = this.findNode(this.root, w, h);
		if (node) {
			return this.splitNode(node, w, h);
		} else {
			return null;
		}
	}

};