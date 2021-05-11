const FIRST_INDEX = 0;
const NOT_FOUND = 0;

var Sorters = {
	w: function (a, b) {
		return b.w - a.w;
	},
	h: function (a, b) {
		return b.h - a.h;
	},
	a: function (a, b) {
		return b.area - a.area;
	},
	max: function (a, b) {
		return Math.max(b.w, b.h) - Math.max(a.w, a.h);
	},
	min: function (a, b) {
		return Math.min(b.w, b.h) - Math.min(a.w, a.h);
	}
};

var MultiSorters = {
	height: function (a, b) {
		return msort(a, b, ['h', 'w']);
	},
	width: function (a, b) {
		return msort(a, b, ['w', 'h']);
	},
	area: function (a, b) {
		return msort(a, b, ['a', 'h', 'w']);
	},
	maxside: function (a, b) {
		return msort(a, b, ['max', 'min', 'h', 'w']);
	}
};

export function run (method, files) {
	if (method !== 'none') {
		var filter = MultiSorters[method];
		if (filter) {
			files.sort(filter);
		}
	}
};

function msort (a, b, criteria) { /* sort by multiple criteria */
	var diff, n;

	for (n = FIRST_INDEX; n < criteria.length; n++) {
		diff = Sorters[criteria[n]](a, b);

		if (diff !== FIRST_INDEX) {
			return diff;
		}
	}

	return NOT_FOUND;
}
