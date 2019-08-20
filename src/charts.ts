import dc from 'dc';
import * as d3 from 'd3';
import crossfilter from 'crossfilter';
import zipcodes from 'zipcodes';

interface PlaidData {
	transactions: {
		transactions: Array<PlaidTransaction>
	};
}

interface PlaidTransaction {
	date: string;
	amount: number;
	category: string[];
	location: {
		postal_code: number;
	};
	name: string;
}

const barChart = dc.barChart('#amountBarChart');
const table = dc.dataTable('#table');
const pie = dc.pieChart('#pie');
const map = dc.geoChoroplethChart('#map');
const textFilter = (dc as any).textFilterWidget('#search');
const line = dc.lineChart('#line');
const noCat = 'No Category';
const tableSize = 20;
let tablePosition = 0;
let ndx;
let all;

function loadCharts() {
	d3.json('transactions').then((data: PlaidData) => {
		const transactionData = data.transactions.transactions;
		ndx = crossfilter(transactionData);
		all = ndx.groupAll();

		const dateDimension = ndx.dimension((d: PlaidTransaction) => new Date(d.date));
		const amountByDateGroup = dateDimension.group().reduceSum((d: PlaidTransaction) => d.amount);
		const allAmountByDateGroups = amountByDateGroup.all();

		const categoriesDimension = ndx.dimension((d: PlaidTransaction) =>  d.category ? d.category[0] : noCat);
		const categoriesGroup = categoriesDimension.group();

		const stateDimension = ndx.dimension((d: PlaidTransaction) => zipcodes.lookup(d.location.postal_code || 48104).state);
		const stateGroup = stateDimension.group().reduceSum((d: PlaidTransaction) => d.amount > 0 ? d.amount : 0);

		const nameDimension = ndx.dimension((d: PlaidTransaction) => d.name);

		const dateByMonthDimension = ndx.dimension((d: PlaidTransaction) => d3.timeMonth(new Date(d.date)));
		const dateByMonthGroup = dateByMonthDimension.group().reduceSum((d: PlaidTransaction) => d.amount > 0 ? d.amount : 0);

		const startDate = allAmountByDateGroups[0].key;
		const endDate = allAmountByDateGroups[allAmountByDateGroups.length - 1].key;

		barChart
			.width(400)
			.height(400)
			.margins({top: 20, left: 50, right: 10, bottom: 50})
			.x(d3.scaleTime().domain([startDate, endDate]))
			.xUnits(d3.timeDays)
			.brushOn(true)
			.xAxisLabel('Date')
			.yAxisLabel('Amount')
			.dimension(dateDimension)
			.group(amountByDateGroup)
			.controlsUseVisibility(true);

		barChart.yAxis().tickFormat((d) => `$${d}`);

		table
			.dimension(dateDimension)
			.size(Infinity)
			.controlsUseVisibility(true)
			.columns([
				'date',
				{
					label: 'Amount',
					format: (d) => d3.format('$.2f')(d.amount)
				},
				'name',
				{
					label: 'Category',
					format: (d) => d.category ? d.category.join(', ') : noCat
				}
			])
			.sortBy((d) => d.date)
			.on('preRender', updateTable)
			.on('preRedraw', updateTable);

		textFilter
			.placeHolder('Search by Name')
			.dimension(nameDimension);

		pie
			.width(440)
			.height(360)
			.dimension(categoriesDimension)
			.controlsUseVisibility(true)
			.group(categoriesGroup)
			.legend(dc.legend())
			.label((d) => {
				let label = d.key;
				if (all.value()) {
					label += '(' + Math.floor(d.value / (all as any).value() * 100) + '%)';
				}
				return label;
			});

		line
			.width(768)
			.height(480)
			.margins({top: 20, left: 50, right: 10, bottom: 50})
			.x(d3.scaleTime()).elasticX(true)
			.round(d3.timeMonth.round)
			.xUnits(d3.timeMonths)
			.renderArea(true)
			.brushOn(false)
			.renderDataPoints(true)
			.clipPadding(10)
			.yAxisLabel('Monthly spend')
			.dimension(dateByMonthDimension)
			.group(dateByMonthGroup)
			.title((d) => `${d3.timeFormat('%b')(d.key)}: ${d3.format('$.2f')(d.value)}`)
			.xAxis()
			.ticks(d3.timeMonth, 1)
			.tickFormat(d3.timeFormat('%b'));

		line.yAxis().tickFormat((d) => `$${d}`);

		const range: any = ['#E2F2FF', '#C4E4FF', '#9ED2FF', '#81C5FF', '#6BBAFF', '#51AEFF', '#36A2FF', '#1E96FF', '#0089FF', '#0061B5'];

		d3.json('us-states.json').then((statesJson) => {
			map
				.width(700)
				.height(500)
				.dimension(stateDimension)
				.group(stateGroup)
				.colors(d3.scaleQuantize().range(range) as any)
				.colorDomain([0, 50])
				.colorCalculator((d) => d ? (map.colors() as any)(d) : '#ccc')
				.projection(d3.geoAlbersUsa() as any)
				.valueAccessor((keyValue) => keyValue.value)
				.title((d) => {
					return 'State: ' + d.key + '\nTotal Amount Spent: ' + d3.format('$.2f')(d.value ? d.value : 0);
				})
				.controlsUseVisibility(true)
				.overlayGeoJson(statesJson.features, 'state', (d) => d.properties.name);

			dc.renderAll();

			map.selectAll('g.state').each(function (d) {
				d3.select(this).attr('transform', 'scale(0.75)');
			});
		});
	});
}

loadCharts();

const redraw = () => {
	dc.redrawAll();
};

const updateTable = () => {
	(table as any).beginSlice(tablePosition);
	(table as any).endSlice(tablePosition + tableSize);
};

// not pretty but it works for getting something working quickly
// @ts-ignore
window.resetBarChart = function resetBarChart() {
	barChart.filterAll();
	redraw();
};

// @ts-ignore
window.resetTable = function resetTable() {
	table.filterAll();
	redraw();
};

// @ts-ignore
window.resetPie = function resetPie() {
	pie.filterAll();
	redraw();
};

// @ts-ignore
window.resetMap = function resetMap() {
	map.filterAll();
	redraw();
};

// @ts-ignore
window.next = function next() {
	if (tablePosition + tableSize < all.value()) {
		tablePosition += tableSize;
	} else {
		tablePosition = all.value() - tableSize;
	}
	updateTable();
	table.redraw();
};

// @ts-ignore
window.previous = function previous() {
	if (tablePosition - tableSize > 0) {
		tablePosition -= tableSize;
	} else {
		tablePosition = 0;
	}
	updateTable();
	table.redraw();
};
