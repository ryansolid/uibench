import React from 'react';
import URI from 'URIjs';
import d3 from 'd3';

function stdev(items) {
  var m = d3.mean(items);

  var variance = d3.mean(items.map(function(i) {
    var diff = i - m;
    return diff * diff;
  }));

  return Math.sqrt(variance);
}

function Report(name, version, samples) {
  this.name = name;
  this.version = version;
  this.samples = samples;
}

Report.prototype.addSamples = function(samples) {
  var keys = Object.keys(samples);
  for (var i = 0; i < keys.length; i++) {
    var sampleName = keys[i];
    var s = samples[sampleName];
    var v = this.samples[s.name];
    if (v === void 0) {
      this.samples[sampleName] = s;
    } else {
      this.samples[sampleName] = v.concat(s);
    }
  }
};

function Results() {
  this.reports = [];
  this.sampleNames = [];
  this.sampleNamesIndex = {};
}

Results.prototype.find = function(name, version) {
  for (var i = 0; i < this.reports.length; i++) {
    var report = this.reports[i];
    if (report.name === name && report.version === version) {
      return report;
    }
  }
  return null;
};

Results.prototype.update = function(name, version, samples) {
  var r = this.find(name, version);

  if (r == null) {
    this.reports.push(new Report(name, version, samples));
  } else {
    r.addSamples(samples);
  }

  // update list of sample names
  var keys = Object.keys(samples);
  for (var i = 0; i < keys.length; i++) {
    var sampleName = keys[i];
    var v = this.sampleNamesIndex[sampleName];
    if (v === void 0) {
      this.sampleNamesIndex[sampleName] = this.sampleNames.length;
      this.sampleNames.push(sampleName);
    }
  }
};

class Header extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  render() {
    return (
        <div className="jumbotron">
          <div className="container">
            <h1>UI Benchmark</h1>
            <p>To start benchmarking, click on the "Open" button below library name that you want to test, it will
              open a new window, perform tests and send results back to the main window, results will be displayed
              at the bottom section "Results".</p>
            <p>This benchmark measures how long it takes to perform update from one state to another, it doesn't
              measure how long will take paint/layout/composition phases, just js part.</p>
            <p>In the "Results" section there will be different test cases, for example test case <code>table/[100,4]/render</code> represents
              update from empty table to table with 100 rows and 4 columns. Test case <code>table/[100,4]/filter/32</code> is
              an update from table with 100 rows and 4 columns to the same table where each 32th item is removed.
              Details about all test cases can be found inside the <a href="https://github.com/localvoid/uibench-base/blob/master/lib/init.js">init.js</a> file.</p>
          </div>
        </div>
    );
  }
}

class Contestant extends React.Component {
  openWindow(e) {
    var q = {
      report: true,
      i: this.props.opts.iterations
    };
    if (this.props.opts.disableSCU) {
      q.disableSCU = true;
    }
    if (this.props.opts.enableDOMRecycling) {
      q.enableDOMRecycling = true;
    }
    if (this.props.opts.mobileMode) {
      q.mobile = true;
    }
    window.open(URI(this.props.benchmarkUrl).addQuery(q), '_blank');
  }

  render() {
    return (
        <div className="list-group-item">
          <h4 className="list-group-item-heading"><a href={this.props.url} target="_blank">{this.props.name}</a></h4>
          <div className="btn-group btn-group-xs">
            <button className="btn btn-default" onClick={this.openWindow.bind(this)}>Open</button>
          </div>
        </div>
    );
  }
}

class CustomContestant extends React.Component {
  constructor(props) {
    super(props);
    this.state = {url: ''};
  }

  changeUrl(e) {
    this.setState({url: e.target.value});
  }

  openWindow(e) {
    var q = {
      report: true,
      i: this.props.opts.iterations
    };
    if (this.props.opts.disableSCU) {
      q.disableSCU = true;
    }
    if (this.props.opts.mobileMode) {
      q.mobile = true;
    }
    window.open(URI(this.state.url).addQuery(q), '_blank');
  }

  render() {
    return (
        <div key="custom_url" className="list-group-item">
          <h4 className="list-group-item-heading">Custom URL</h4>
          <div className="input-group">
            <input type="text" className="form-control" placeholder="http://www.example.com" value={this.state.url} onChange={this.changeUrl.bind(this)} />
            <span className="input-group-btn">
              <button className="btn btn-default" onClick={this.openWindow.bind(this)}>Open</button>
            </span>
          </div>
        </div>
    );
  }
}

class Contestants extends React.Component {
  render() {
    var props = this.props;
    return (
        <div className="list-group">
          {this.props.contestants.map(function(c) {
            return (<Contestant key={`${c.name}__${c.version}`} {...c} opts={props.opts} />);
          })}
          <CustomContestant key="custom" opts={props.opts} />
        </div>
    )
  }
}

class ResultsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filter: ''
    }
  }

  handleFilterChange(e) {
    this.setState({filter: e.target.value});
  }

  render() {
    var filter = this.state.filter;
    var results = this.props.results;
    var sampleNames = results.sampleNames;
    var reports = results.reports;

    if (reports.length === 0) {
      return (
          <div className="panel panel-default">
            <div className="panel-heading">Results (lower is better)</div>
            <div className="panel-body">Empty</div>
          </div>
      );
    }

    var titles = reports.map(function(r) {
      return (<th key={r.name + '__' + r.version}>{r.name} <small>{r.version}</small></th>);
    });

    var rows = [];
    var overallTime = reports.map(function(r) { return 0; });

    for (var i = 0; i < sampleNames.length; i++) {
      var sampleName = sampleNames[i];
      if (sampleName.indexOf(filter) === -1) {
        continue;
      }

      var cols = [(<td key="sampleName"><code>{sampleName}</code></td>)];

      var values = reports.map(function(r) {
        var samples = r.samples[sampleName];

        return {
          sampleCount: samples.length,
          median: d3.median(samples),
          mean: d3.mean(samples),
          stdev: stdev(samples),
          min: d3.min(samples),
          max: d3.max(samples)
        };
      });

      var medianValues = values.map(function(v) { return v.median; });
      var medianMin = d3.min(medianValues);

      var scale = d3.scale.linear().domain([medianMin, d3.max(medianValues)]);

      for (var j = 0; j < reports.length; j++) {
        var report = reports[j];
        var value = values[j];
        var style = {
          background: 'rgba(46, 204, 64, ' + ((1 - scale(value.median)) * 0.5).toString() + ')'
        };

        var title = 'samples: ' + value.sampleCount.toString() + '\n';
        title += 'median: ' + Math.round(value.median * 1000).toString() + '\n';
        title += 'mean: ' + Math.round(value.mean * 1000).toString() + '\n';
        title += 'stdev: ' + Math.round(value.stdev * 1000).toString() + '\n';
        title += 'min: ' + Math.round(value.min * 1000).toString() + '\n';
        title += 'max: ' + Math.round(value.max * 1000).toString();

        var percent = medianMin === value.median ? null : (<small>{'(' + (((value.median / medianMin) - 1) * 100).toFixed(2) + '%)'}</small>);

        cols.push((
            <td key={report.name + '__' + report.version} title={title} style={style}>
              {Math.round(value.median * 1000)} {percent}
            </td>
        ));

        overallTime[j] += Math.round(value.median * 1000);
      }

      rows.push((<tr key={sampleName}>{cols}</tr>));
    }

    return (
        <div className="panel panel-default">
          <div className="panel-heading">Results (lower is better)</div>
          <div className="panel-body">
            <h4>Flags:</h4>
            <ul>
              <li><strong>+r</strong> means that library is using DOM recycling, and instead of creating new DOM nodes
                on each update, it reuses them, so it breaks test cases like "render" and "insert".</li>
              <li><strong>+s</strong> means that library is using
                <code>shouldComponentUpdate</code> optimization.</li>
            </ul>
            <p>Don't use <u>Overall time</u> row to make any conclusions, like library X is N times faster than
              library Y. This row is used by library developers to easily check if there is some regression.</p>
            <div className="input-group">
              <span className="input-group-addon">Filter</span>
              <input type="text" className="form-control" placeholder="For ex.: update()" value={filter} onChange={this.handleFilterChange.bind(this)} />
            </div>
            <table className="table table-condensed">
              <thead><tr><th key="empty"></th>{titles}</tr></thead>
              <tbody>
              <tr><td key="empty">Overall Time</td>{overallTime.map(function(t) { return (<td>{t}</td>); })}</tr>
              {rows}
              </tbody>
            </table>
          </div>
        </div>
    );
  }
}

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      disableSCU: false,
      enableDOMRecycling: false,
      mobileMode: false,
      iterations: 3
    };
  }

  onMobileModeChange(e) {
    this.setState({mobileMode: e.target.checked});
  }

  onDisableSCUChange(e) {
    this.setState({disableSCU: e.target.checked});
  }

  onEnableDOMRecyclingChange(e) {
    this.setState({enableDOMRecycling: e.target.checked});
  }

  onIterationsChange(e) {
    this.setState({iterations: e.target.value});
  }

  render() {
    return (
        <div>
          <Header />
          <div className="container">
            <div className="panel panel-default">
              <div className="panel-body">
                <div className="checkbox">
                  <label>
                    <input type="checkbox" value={this.state.disableSCU} onChange={this.onDisableSCUChange.bind(this)} />
                    Disable <code>shouldComponentUpdate</code> optimization
                  </label>
                </div>
                <div className="checkbox">
                  <label>
                    <input type="checkbox" value={this.state.enableDOMRecycling} onChange={this.onEnableDOMRecyclingChange.bind(this)} />
                    Enable DOM recycling
                  </label>
                </div>
                <div className="checkbox">
                  <label>
                    <input type="checkbox" value={this.state.mobileMode} onChange={this.onMobileModeChange.bind(this)} />
                    Mobile mode
                  </label>
                </div>
                <div className="form-group">
                  <label for="iterations">Iterations</label>
                  <input type="number" className="form-control" id="iterations" value={this.state.iterations} onChange={this.onIterationsChange.bind(this)} />
                </div>
              </div>
            </div>
            <Contestants contestants={this.props.contestants} opts={this.state} />
            <ResultsTable results={this.props.results} />
          </div>
        </div>
    );
  }
}


document.addEventListener('DOMContentLoaded', function(e) {
  var container = document.querySelector('#App');
  var state = {
    contestants: [
      {
        'name': 'React 0.14',
        'url': 'https://facebook.github.io/react/',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-react/'
      },
      {
        'name': 'React 15',
        'url': 'https://facebook.github.io/react/',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-react-dev/'
      },
      {
        'name': 'Bobril',
        'url': 'https://github.com/Bobris/Bobril',
        'benchmarkUrl': 'https://bobris.github.io/uibench-bobril/'
      },
      {
        'name': 'Deku',
        'url': 'https://github.com/dekujs/deku',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-deku/'
      },
      {
        'name': 'Mercury',
        'url': 'https://github.com/Raynos/mercury',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-mercury/'
      },
      {
        'name': 'kivi',
        'url': 'https://github.com/localvoid/kivi',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-kivi/'
      },
      {
        'name': 'Preact',
        'url': 'https://github.com/developit/preact',
        'benchmarkUrl': 'https://developit.github.io/uibench-preact/'
      },
      {
        'name': 'React-lite',
        'url': 'https://github.com/Lucifier129/react-lite',
        'benchmarkUrl': 'https://localvoid.github.io/uibench-react-lite/'
      },
      {
        'name': 'Imba',
        'url': 'https://github.com/somebee/imba',
        'benchmarkUrl': 'http://somebee.github.io/uibench-imba/'
      }

    ],
    results: new Results()
  };

  window.addEventListener('message', function(e) {
    var type = e.data.type;
    var data = e.data.data;

    if (type === 'report') {
      state.results.update(data.name, data.version, data.samples);
      React.render(<Main {...state}/>, container);
    }
  });

  React.render(<Main {...state}/>, container);
});