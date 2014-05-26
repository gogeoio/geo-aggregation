'use strict';

var map = null;
var group = null;
var polygon = null;

var editableLayers = null;

var databaseName = 'db1';
var collectionName = 'simplegeo_places_8m';
var mapkey = '123';

var gogeoUrl = 'https://maps.gogeo.io/';
// var gogeoUrl = 'http://192.168.88.117:9090/';
var geoAggUrl = gogeoUrl + 'geoagg';

var addBaseLayer = function(map) {
  var baseLayer = L.tileLayer('http://{s}.maptile.lbs.ovi.com/maptiler/v2/maptile/newest/normal.day.grey/{z}/{x}/{y}/256/png8?token=gBoUkAMoxoqIWfxWA5DuMQ&app_id=mBCJzriKRMXN-4giYVBc', {
      subdomains: '123',
      maxZoom: 14
  });

  map.addLayer(baseLayer);

  return baseLayer;
};

var addCluster = function(clusterUrl, subdomains, group) {
  var options = {
    maxZoom: 18,
    subdomains: subdomains,
    useJsonP: true,
    calculateClusterQtd: function(zoom) {
      if (zoom >= 5) {
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
      updateResultList(data.buckets, data.doc_total);
    } 
  });
};

var updateResultList = function(result, total) {
  $('#geosearch-result-list').empty();
  $('#geosearch-result-qtd').empty();

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
    var itemHtml = getItemHtml(item);
    listHtml.push(itemHtml);
  }

  var othersSum = 0;
  for (var i = 0; i < others.length; i++) {
    var item = others[i];
    othersSum = othersSum + item.doc_count;
  }

  if (othersSum > 0) {
    var othersHtml = getItemHtml({key: 'Others', doc_count: othersSum});
    listHtml.push(othersHtml);
  }

  listHtml = listHtml.join('\n');

  $('#geosearch-result-list').append(listHtml);
  $('#geosearch-result-qtd').html('<b>' + total + '</b>');
};

var getItemHtml = function(item) {
  var tr = document.createElement('tr'),
      tdCat = document.createElement('td'),
      tdVal = document.createElement('td'),
      spanBadges = document.createElement('td');

  tdCat.textContent = item.key;

  spanBadges.className = 'badge';
  spanBadges.textContent = item.doc_count;
  spanBadges.style.marginTop = '4px';
  tdVal.appendChild(spanBadges);

  tr.appendChild(tdCat);
  tr.appendChild(tdVal);
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

var addControls = function(map) {
  editableLayers = new L.FeatureGroup();
  map.addLayer(editableLayers);

  var options = {
    position: 'topleft',
    draw: {
      polyline: false,
      polygon: {
        allowIntersection: false, // Restricts shapes to simple polygons
        drawError: {
          color: '#E1E100'
        },
        shapeOptions: {
          color: '#BADA55'
        }
      },
      circle: false, // Turns off this drawing tool
      rectangle: {
        shapeOptions: {
          clickable: true
        }
      },
      marker: false
    },
    edit: false
  };

  var drawControl = new L.Control.Draw(options);
  map.addControl(drawControl);

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

      getAgg(geometry, points);
    }
  );

  map.on('draw:drawstart',
    function(e) {
      editableLayers.clearLayers();
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
  map = L.map('map').setView([38.513788, -98.092804], 4);
  group = new L.LayerGroup().addTo(map);

  addBaseLayer(map);

  var clusterUrl = gogeoUrl + '/map/' + databaseName + '/' + collectionName + '/{z}/{x}/{y}/cluster.json?mapkey=' + mapkey + '&callback={cb}',
      subdomains = ['m1', 'm2', 'm3'];
  addCluster(clusterUrl, subdomains, group);

  addControls(map);
  
  var bounds = map.getBounds();
  var points = getNeSwPoints(bounds);
  getAgg(null, points);
};

initMaps();

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
  $('.leaflet-draw-draw-polygon').animate({'height': '26px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'top': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '46px'}, {'duration': 200, 'queue': false}, function(){});
};

var hideDrawbuttons = function() {
  $('.leaflet-draw-draw-rectangle').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw-draw-polygon').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'top': '28px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '3px'}, {'duration': 200, 'queue': false}, function(){});
};