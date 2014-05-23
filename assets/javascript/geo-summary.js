var showDrawbuttons = function() {
  $('.leaflet-draw-actions').remove();
  $('.leaflet-draw-draw-rectangle').animate({'height': '26px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw-draw-polygon').animate({'height': '26px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'top': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '51px'}, {'duration': 200, 'queue': false}, function(){});
};

var hideDrawbuttons = function() {
  $('.leaflet-draw-draw-rectangle').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw-draw-polygon').animate({'height': '0px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'top': '28px'}, {'duration': 200, 'queue': false}, function(){}); 
  $('.leaflet-draw').animate({'left': '3px'}, {'duration': 200, 'queue': false}, function(){});
};

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

var getAndShowSumary = function(geojson) {
  $('#geosearch-result-list').empty();
  
  var result = {
    shop: Math.floor((Math.random() * 10000) + 1),
    bar: Math.floor((Math.random() * 10000) + 1),
    restaurant: Math.floor((Math.random() * 10000) + 1),
  };

  listHtml = [];
  for (var item in result) {
    var tr = document.createElement('tr'),
        td_cat = document.createElement('td'),
        td_val = document.createElement('td'),
        span_badges = document.createElement('td');

    td_cat.textContent = item;
    
    span_badges.className = "badge";
    span_badges.textContent = result[item];
    td_val.appendChild(span_badges);
    
    tr.appendChild(td_cat);
    tr.appendChild(td_val);
    listHtml.push(tr.outerHTML);
  }
  
  listHtml = listHtml.join('\n');
  $('#geosearch-result-list').append(listHtml);
};

var featureGroupToGeoJson = function(featureGroup) {
  var polygons = featureGroup.getLayers();

  var geojson = {};
  geojson['type'] = 'Polygon';
  geojson['coordinates'] = [];

  polygons[0]._latlngs.forEach(function(coord) {
    var latLong = [];
    latLong.push(coord.lng);
    latLong.push(coord.lat);
    
    geojson['coordinates'].push(latLong);
  });

  return geojson;
};

var boundsToGeoJson = function(bounds) {
  var geojson = {};
  geojson['type'] = 'Polygon';

  var coords = [];
  
  var coord = bounds.getSouthWest();
  coords[0] = [coord.lng, coord.lat];

  coord = bounds.getNorthEast();
  coords[1] = [coord.lng, coord.lat];

  coord = bounds.getNorthWest();
  coords[2] = [coord.lng, coord.lat];

  coord = bounds.getSouthEast();
  coords[3] = [coord.lng, coord.lat];

  geojson['coordinates'] = coords;

  return geojson;
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
          color: '#e1e100'
        },
        shapeOptions: {
          color: '#bada55'
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
      var geojson = featureGroupToGeoJson(editableLayers);
      getAndShowSumary(geojson);
    }
  );

  map.on('draw:drawstart',
    function(e) {
      editableLayers.clearLayers();
    }
  );

  map.on('moveend', function(e) {
    var layersDrawn = editableLayers.getLayers();
    
    if(layersDrawn.length == 0) {
      var bounds = map.getBounds();
      var geojson = boundsToGeoJson(bounds);
      getAndShowSumary(geojson);
    }
  });
};

var initMaps = function() {
  map = L.map('map').setView([-10, -55], 5);
  group = new L.LayerGroup().addTo(map);

  addBaseLayer(map);

  // var clusterUrl = "https://{s}.gogeo.io//map/geo_summary/geo_names/{z}/{x}/{y}/cluster.json?mapkey=141bb3be-619a-4ffd-9aab-664ad92e568e",
  var clusterUrl = "https://{s}.gogeo.io/map/databases/50kcompanies/{z}/{x}/{y}/cluster.json?mapkey=c5b8c3ca-2e80-46bf-bf51-aa74101c46bb&callback={cb}",
      subdomains = ["m1","m2","m3"];
  
  addCluster(clusterUrl, subdomains, group);
  addControls(map);
};

initMaps();
$('.leaflet-draw-draw-rectangle').css('height', '0px');

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