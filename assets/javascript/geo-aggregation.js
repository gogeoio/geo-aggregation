'use strict';

var map = null;
var group = null;
var polygon = null;
var geometry = null;
var maxZoom = 18;
var tour = null;

var pngLayer = null;
var pngUrl = null;
var clusterLayer = null;
var clusterUrl = null;

var editableLayers = null;

var gogeoUrl = 'https://{s}.gogeo.io';
var geoAggUrl = 'https://maps.gogeo.io/geoagg';
var subdomains = ['m1', 'm2', 'm3', 'm4'];

var databaseName = 'demos';
var collectionName = 'simplegeo_4m';
var mapkey = 'a9b6ed7c-0404-40e0-8c83-64cfcadd276d';

var addClusterLayer = function() {
  var url = clusterUrl;
  if (geometry) {
    url = url + '&geom=' + JSON.stringify(geometry);
  }

  group.clearLayers();

  var options = {
    maxZoom: maxZoom,
    subdomains: subdomains,
    useJsonP: false,
    calculateClusterQtd: function(zoom) {
      if (zoom >= 6) {
        return 2;
      } else {
        return 1;
      }
    }
  };

  clusterLayer = L.tileCluster(url, options);
  group.addLayer(clusterLayer);

  return clusterLayer;
};

var addPngLayer = function() {
  var url = pngUrl;

  if (geometry) {
    url = url + '&geom=' + JSON.stringify(geometry);
  }

  group.clearLayers();

  var options = {
    maxZoom: maxZoom,
    subdomains: subdomains,
    reuseTiles: true,
    unloadInvisibleTiles: true,
    updateWhenIdle: true
  };

  pngLayer = L.tileLayer(url, options);
  group.addLayer(pngLayer);

  pngLayer.bringToFront();

  return pngLayer;
};

var getAgg = function(geojson, points) {
  var params = {
    field: 'category',
    agg_size: 100
  };

  if (geojson) {
    params['geom'] = geojson;
  } else {
    params['points'] = {
     top_right: points[0],
     bottom_left: points[1]
    }
  }

  $.ajax({
    url: geoAggUrl + '/' + databaseName + '/' + collectionName + '?mapkey=' + mapkey,
    data: JSON.stringify(params),
    type: 'POST',
    contentType: 'application/json',
    crossDomain: true,
    dataType: 'json',
    async: true,
    success: function(data) {
      if (data && data.buckets && data.doc_total) {
        updateResultList(data.buckets, data.doc_total);
      } else {
        emptyResultList();
      }
    } 
  });
};

var emptyResultList = function() {
  $('#geoagg-result-list').empty();
  $('#geoagg-result-qtd').empty();
};

var updateResultList = function(result, total) {
  emptyResultList();

  var firsts = [];
  var others = [];

  if (result.length >= 10) {
    firsts = result.slice(0, 9);
    others = result.slice(9, result.length);
  } else {
    firsts = result;
  }

  var listHtml = [];

  for (var i = 0; i < firsts.length; i++) {
    var item = firsts[i];
    var itemHtml = getItemHtml(item, total);
    listHtml.push(itemHtml);
  }

  var othersSum = 0;
  for (var i = 0; i < others.length; i++) {
    var item = others[i];
    othersSum = othersSum + item.doc_count;
  }

  if (othersSum > 0) {
    var othersHtml = getItemHtml({key: 'Others', doc_count: othersSum}, total);
    listHtml.push(othersHtml);
  }

  listHtml = listHtml.join('\n');

  var totalHtml = '<b>' + $.number(total, 0, '.', '.') + '</b>';

  $('#geoagg-result-list').append(listHtml);
  $('#geoagg-result-qtd').html(totalHtml);
};

var getItemHtml = function(item, total) {
  var tr = document.createElement('tr'),
      tdCat = document.createElement('td'),
      spanBadges = document.createElement('td'),
      divResult = document.createElement('div'),
      divRow = document.createElement('div'),
      divProgress = document.createElement('div'),
      divProgressBar = document.createElement('div'),
      labelNameBar = document.createElement('div'),
      labelValueBar = document.createElement('div')
    ;

  var percent = (item.doc_count * 100) / total;
  percent = $.number(percent, 2);

  divResult.setAttribute('class', 'container result');
  divRow.setAttribute('class', 'row');
  divProgress.setAttribute('class', 'progress');

  divProgressBar.setAttribute('class', 'progress-bar');
  divProgressBar.setAttribute('role', 'progressbar');
  divProgressBar.setAttribute('aria-valuenow', percent);
  divProgressBar.setAttribute('aria-valuemin', '0');
  divProgressBar.setAttribute('aria-valuemax', '100');
  divProgressBar.style.width = percent + '%';

  labelNameBar.setAttribute('class', 'col-md-6 label-name');
  labelNameBar.textContent = item.key;

  var valueBarHtml = $.number(item.doc_count, 0, '.', '.');
  valueBarHtml += ' ( ' + percent + '% )';

  labelValueBar.setAttribute('class', 'col-md-6 label-value');
  labelValueBar.textContent = valueBarHtml;

  divProgressBar.appendChild(labelNameBar);
  divProgressBar.appendChild(labelValueBar);

  divProgress.appendChild(divProgressBar);
  divRow.appendChild(divProgress);
  divResult.appendChild(divRow);
  tdCat.appendChild(divResult);

  tr.appendChild(tdCat);
  return tr.outerHTML;
}

var getNeSwPoints = function(bounds) {
  var ne = [bounds._northEast.lng, bounds._northEast.lat];
  var sw = [bounds._southWest.lng, bounds._southWest.lat];

  return [ne, sw];
};

var addResetButton = function() {
  var resetButton = document.createElement('a');
  
  resetButton.setAttribute('id', 'resetButton');
  resetButton.setAttribute('class', 'leaflet-draw-edit-remove leaflet-disabled');
  resetButton.setAttribute('href', '#');
  resetButton.setAttribute('title', 'Reset area');

  var drawToolbar = $('.leaflet-draw-toolbar.leaflet-bar.leaflet-draw-toolbar-top');
  drawToolbar.append(resetButton);

  $('#resetButton').on('click',
    function(event) {
      if ($('#resetButton').prop('class').match('leaflet-disabled')) {
        event.preventDefault();
        return;
      } else {
        editableLayers.clearLayers();
        toggleResetButton(false);
        geometry = null;
        reloadGeoAggWithMapBounds();
        group.clearLayers();
        showLayer();
      }
    }
  );
};

var toggleResetButton = function(enable) {
  if (enable) {
    $('#resetButton').prop('class', 'leaflet-draw-edit-remove');
  } else {
    $('#resetButton').prop('class', 'leaflet-draw-edit-remove leaflet-disabled');
  }
};

var addControls = function(map) {
  editableLayers = new L.FeatureGroup();
  map.addLayer(editableLayers);

  var options = {
    position: 'topleft',
    draw: {
      polyline: false,
      polygon: false,
      circle: false, // Turns off this drawing tool
      rectangle: {
        shapeOptions: {
          clickable: false
        }
      },
      marker: false
    }
  };

  // Set the text for the rectangle
  L.drawLocal.draw.toolbar.buttons.rectangle = 'Draw an area';

  var drawControl = new L.Control.Draw(options);
  map.addControl(drawControl);

  addResetButton();

  map.on('draw:created',
    function(e) {
      var type = e.layerType,
          layer = e.layer;

      editableLayers.addLayer(layer);

      var geojson = null;
      geometry = null;
      var points = null;

      if (type === 'rectangle') {
        geojson = editableLayers.toGeoJSON();
        geometry = geojson.features[0].geometry;
      } else {
        points = getNeSwPoints(layer.getBounds());
      }

      toggleResetButton(true);
      getAgg(geometry, points);
      group.clearLayers();
      showLayer();

      if (window._gaq) {
        _gaq.push(['_trackEvent', 'draw:created']);
      }
    }
  );

  map.on('draw:drawstart',
    function(e) {
      editableLayers.clearLayers();
      toggleResetButton(false);
    }
  );

  map.on('moveend', updateGeoAgg);
  map.on('zoomend', showLayer);
};

var addTourTips = function() {
  $('.leaflet-draw.leaflet-control').attr('id', 'leaflet-control');

  // Instance the tour
  tour = new Tour({
    template: '<div class="popover tour">' +
        '<div class="arrow"></div>' +
        '<h3 class="popover-title"></h3>' +
        '<div class="popover-navigation">' +
          '<button class="btn small btn-default" data-role="prev">« Prev</button>' +
          '<span data-role="separator"> </span>' +
          '<button class="btn small btn-default" data-role="next">Next »</button>' +
          '<button class="btn btn-default" data-role="end">End tour</button>' +
      '</div>' +
    '</div>',
    steps: [
    {
      element: '.leaflet-control-zoom.leaflet-bar.leaflet-control',
      title: 'Zoom in/out to change the detail level (use this buttons or your mouse wheel).',
      next: 1,
      prev: -1
    },
    {
      element: '.leaflet-draw.leaflet-control',
      title: 'Click the rectangle to draw a spatial restriction!',
      next: 2,
      prev: 0
    },
    {
      element: '#geoagg-result-div',
      title: 'This dashboard will be updated as you interact with the map!',
      next: -1,
      prev: 1,
      placement: 'left'
    }
  ]});

  // Initialize the tour
  tour.init();

  // Start the tour
  tour.start();
};

$(document).on('click', '#help-div',
  function() {
    tour.start(true);
    if (tour.getCurrentStep() != 0) {
      tour.goTo(0);
    }
  }
);

var showTour = function() {
  console.log('click');
};

var updateGeoAgg = function() {
  var layersDrawn = editableLayers.getLayers();

  if (layersDrawn.length == 0) {
    var bounds = map.getBounds();
    var points = getNeSwPoints(bounds);

    getAgg(null, points);
  }
};

var addTileLayer = function(url, subdomains) {
  var options = {
    maxZoom: maxZoom
  };

  if (subdomains) {
    options.subdomains = subdomains;
  }

  var layer = L.tileLayer(url, options);
  group.addLayer(layer);
};

var initMaps = function() {
  var options = {
    attributionControl: false,
    minZoom: 4,
    maxZoom: maxZoom,
    zoom: 5,
    center: [34.732047, -92.296385],
    maxBounds: [
      [84.67351256610522, -174.0234375],
      [-57.13, 83.32]
    ]
  };

  map = L.map('map', options);
  group = new L.LayerGroup().addTo(map);

  var ggl = new L.Google('ROADMAP', options);
  map.addLayer(ggl);

  clusterUrl = gogeoUrl + '/map/' + databaseName + '/' + collectionName + '/{z}/{x}/{y}/cluster.json?mapkey=' + mapkey;
  pngUrl = gogeoUrl + '/map/' + databaseName + '/' + collectionName + '/{z}/{x}/{y}/tile.png?mapkey=' + mapkey + '&buffer=16';

  showLayer();

  addControls(map);
  addTourTips();
  addAttribution(map);
  configureSize();

  var bounds = map.getBounds();
  var points = getNeSwPoints(bounds);
  getAgg(null, points);
};

var showLayer = function() {
  var zoom = map.getZoom();

  if (zoom >= 15) {
    // Show png layer

    if (clusterLayer) {
      clusterLayer = null;
      group.clearLayers();
    }

    if (!pngLayer || group.getLayers().length == 0) {
      addPngLayer();
    }
  } else {
    // Show cluster layer

    if (pngLayer) {
      pngLayer = null;
      group.clearLayers();
    }

    if (!clusterLayer || group.getLayers().length == 0) {
      addClusterLayer();
    }
  }
};

var addAttribution = function(map) {
  var gogeoAttribution = '<a target="_blank" href="http://gogeo.io">GoGeo</a>';
  var leafletAttribution = '<a target="_blank" href="http://leafletjs.com">Leaflet</a>';
  var attribution = gogeoAttribution + ' | ' + leafletAttribution;

  L.control.attribution ({
    prefix: false,
    position: 'bottomright'
  }).addAttribution(attribution).addTo(map);
};

var configureSize = function() {
  var innerHeight = parseInt(window.innerHeight) - 15;
  $('#map').css('height', innerHeight + 'px');

  reloadGeoAggWithMapBounds();
};

var reloadGeoAggWithMapBounds = function() {
  var bounds = map.getBounds();
  var points = getNeSwPoints(bounds);
  getAgg(geometry, points);
};

$(document).on('click', '#geoagg-button',
  function() {
    var height = $('.leaflet-draw-draw-rectangle').css('height');
    
    if (height === '0px') {
      showDrawbuttons();
    } else {
      hideDrawbuttons();
    }
  }
);

var showDrawbuttons = function() {
  $('.leaflet-draw-actions').remove();
  $('.leaflet-draw-draw-rectangle').animate({'height': '26px'}, {'duration': 200, 'queue': false}, function(){});
  $('.leaflet-draw').animate({'top': '13px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '35px'}, {'duration': 200, 'queue': false}, function(){});
};

var hideDrawbuttons = function() {
  $('.leaflet-draw-draw-rectangle').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){});
  $('.leaflet-draw').animate({'top': '28px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '3px'}, {'duration': 200, 'queue': false}, function(){});
};

$(window).resize(
  function() {
    configureSize();
  }
);

initMaps();