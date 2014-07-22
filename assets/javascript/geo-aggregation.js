'use strict';

var map = null;
var group = null;
var polygon = null;

var editableLayers = null;

var databaseName = 'geo_summary';
var collectionName = 'places_us_4m';
var mapkey = '141bb3be-619a-4ffd-9aab-664ad92e568e';

var cluster = null;

var gogeoUrl = 'https://{s}.gogeo.io';
var geoAggUrl = 'https://maps.gogeo.io/geoagg';

var addCluster = function(clusterUrl, subdomains, group) {
  var options = {
    maxZoom: 18,
    subdomains: subdomains,
    useJsonP: true,
    calculateClusterQtd: function(zoom) {
      if (zoom >= 6) {
        return 2;
      } else {
        return 1;
      }
    }
  };

  cluster = L.tileCluster(clusterUrl, options);
  group.addLayer(cluster);

  return cluster;
};

var getAgg = function(geojson, points) {
  var params = {
    field: 'category',
    agg_size: 100
  };

  if (geojson) {
    params['geojson'] = geojson;
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
  $('#geosearch-result-list').empty();
  $('#geosearch-result-qtd').empty();
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

  $('#geosearch-result-list').append(listHtml);
  $('#geosearch-result-qtd').html(totalHtml);
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

var featureGroupToGeoJson = function(layer) {
  var geojson = {
    type: 'Polygon',
    coordinates: []
  };

  var pointsAux = layer._latlngs;

  var ne = [pointsAux[2].lat, pointsAux[2].lng];
  var sw = [pointsAux[0].lat, pointsAux[0].lng];

  var points = [
    ne,
    [ne[0], sw[1]],
    sw,
    [sw[0], ne[1]]
  ];

  geojson['coordinates'] = points;

  return geojson;
};

var getNeSwPoints = function(bounds) {
  var ne = [bounds._northEast.lat, bounds._northEast.lng];
  var sw = [bounds._southWest.lat, bounds._southWest.lng];

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
        reloadGeoAggWithMappBounds();
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
      var geometry = null;
      var points = null;

      if (type === 'polygon') {
        geojson = editableLayers.toGeoJSON();
        geometry = geojson.features[0].geometry;
      } else {
        points = getNeSwPoints(layer.getBounds());
      }

      toggleResetButton(true);
      getAgg(geometry, points);
    }
  );

  map.on('draw:drawstart',
    function(e) {
      editableLayers.clearLayers();
      toggleResetButton(false);
    }
  );

  map.on('moveend', function(e) {
    var layersDrawn = editableLayers.getLayers();
    
    if (layersDrawn.length == 0) {
      var bounds = map.getBounds();
      var points = getNeSwPoints(bounds);

      getAgg(null, points);
    }
  });
};

var addTileLayer = function(url, subdomains) {
  var options = {
    maxZoom: 18
  };

  if (subdomains) {
    options.subdomains = subdomains
  }

  var layer = L.tileLayer(url, options);
  group.addLayer(layer);
};

var initMaps = function() {
  var options = {
    attributionControl: false,
    minZoom: 4,
    maxZoom: 14,
    zoom: 4,
    center: [32.54, -99.49],
    maxBounds: [
      [84.67351256610522, -174.0234375],
      [-57.13, 83.32]
    ]
  };

  map = L.map('map', options);

  group = new L.LayerGroup().addTo(map);

  var ggl = new L.Google('ROADMAP', options);
  map.addLayer(ggl);

  var clusterUrl = gogeoUrl + '/map/' + databaseName + '/' + collectionName + '/{z}/{x}/{y}/cluster.json?mapkey=' + mapkey + '&callback={cb}',
      subdomains = ['m1', 'm2', 'm3'];
  addCluster(clusterUrl, subdomains, group);

  addControls(map);
  addAttribution(map);
  configureSize();

  var bounds = map.getBounds();
  var points = getNeSwPoints(bounds);
  getAgg(null, points);
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
  var innerHeight = window.innerHeight;

  $('#map').css('height', innerHeight + 'px');

  reloadGeoAggWithMappBounds();
};

var reloadGeoAggWithMappBounds = function() {
  var bounds = map.getBounds();
  var points = getNeSwPoints(bounds);
  getAgg(null, points);
};

$(document).on('click', '#geosearch-button',
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
  // $('.leaflet-draw-draw-polygon').animate({'height': '26px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'top': '13px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '35px'}, {'duration': 200, 'queue': false}, function(){});
};

var hideDrawbuttons = function() {
  $('.leaflet-draw-draw-rectangle').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  // $('.leaflet-draw-draw-polygon').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){});
  $('.leaflet-draw').animate({'top': '28px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '3px'}, {'duration': 200, 'queue': false}, function(){});
};

$(window).resize(
  function() {
    configureSize();
  }
);

initMaps();