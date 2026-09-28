import json
import math

# 1. 서울 전역 주요 50개 정류장 GPS 좌표
coords = {
    "도봉산역": [37.6894, 127.0462], "노원역": [37.6542, 127.0611], "창동역": [37.6532, 127.0474],
    "수유역": [37.6372, 127.0257], "미아사거리역": [37.6133, 127.0301], "성신여대입구역": [37.5926, 127.0164],
    "혜화역": [37.5822, 127.0018], "종로3가역": [37.5704, 126.9922], "광화문역": [37.5710, 126.9769],
    "충무로역": [37.5612, 126.9942], "퇴계로5가": [37.5582, 127.0016], "동국대후문": [37.5595, 126.9982],
    "동대입구역": [37.5593, 127.0054], "서울역": [37.5547, 126.9707], "용산역": [37.5298, 126.9648],
    "신촌역": [37.5552, 126.9368], "홍대입구역": [37.5575, 126.9244], "합정역": [37.5494, 126.9138],
    "불광역": [37.6105, 126.9298], "연신내역": [37.6190, 126.9210], "청량리역": [37.5802, 127.0000],
    "왕십리역": [37.5612, 127.0385], "건대입구역": [37.5404, 127.0692], "강변역": [37.5350, 127.0947],
    "강남역": [37.4979, 127.0276], "신논현역": [37.5045, 127.0254], "교대역": [37.4934, 127.0141],
    "서초역": [37.4918, 127.0076], "양재역": [37.4842, 127.0346], "역삼역": [37.5006, 127.0364],
    "선릉역": [37.5045, 127.0490], "삼성역": [37.5088, 127.0632], "잠실역": [37.5133, 127.1001],
    "송파역": [37.4994, 127.1123], "천호역": [37.5386, 127.1235], "길동역": [37.5378, 127.1401],
    "노량진역": [37.5138, 126.9412], "여의도역": [37.5216, 126.9242], "영등포역": [37.5158, 126.9076],
    "신도림역": [37.5087, 126.8913], "구로디지털단지역": [37.4852, 126.9015], "신대방역": [37.4875, 126.9131],
    "신림역": [37.4842, 126.9297], "서울대입구역": [37.4782, 126.9515], "낙성대역": [37.4771, 126.9634],
    "사당역": [37.4765, 126.9816], "이수역": [37.4862, 126.9819], "고속터미널역": [37.5048, 127.0049],
    "신사역": [37.5163, 127.0202], "압구정역": [37.5263, 127.0285]
}

# 2. 간선 네트워크
edges = [
    ("도봉산역", "노원역"), ("노원역", "창동역"), ("창동역", "수유역"),
    ("수유역", "미아사거리역"), ("미아사거리역", "성신여대입구역"), ("성신여대입구역", "혜화역"),
    ("혜화역", "종로3가역"), ("종로3가역", "광화문역"), ("광화문역", "충무로역"),
    ("충무로역", "퇴계로5가"), ("퇴계로5가", "동국대후문"), ("동국대후문", "동대입구역"),
    ("충무로역", "서울역"), ("서울역", "용산역"), ("광화문역", "신촌역"),
    ("신촌역", "홍대입구역"), ("홍대입구역", "합정역"), ("연신내역", "불광역"),
    ("불광역", "광화문역"), ("종로3가역", "청량리역"), ("청량리역", "왕십리역"),
    ("왕십리역", "건대입구역"), ("건대입구역", "강변역"), ("강변역", "잠실역"),
    ("서울역", "노량진역"), ("노량진역", "여의도역"), ("여의도역", "영등포역"),
    ("영등포역", "신도림역"), ("신도림역", "구로디지털단지역"), ("구로디지털단지역", "신림역"),
    ("신림역", "서울대입구역"), ("서울대입구역", "사당역"), ("사당역", "교대역"),
    ("교대역", "강남역"), ("강남역", "신논현역"), ("신논현역", "신사역"),
    ("신사역", "고속터미널역"), ("고속터미널역", "교대역"), ("강남역", "역삼역"),
    ("역삼역", "선릉역"), ("선릉역", "삼성역"), ("삼성역", "잠실역"),
    ("잠실역", "송파역"), ("잠실역", "천호역"), ("천호역", "길동역"),
    ("사당역", "이수역"), ("이수역", "고속터미널역"), ("신사역", "압구정역"),
    ("압구정역", "충무로역"), ("양재역", "강남역")
]

def interpolate_points(p1, p2, steps=20):
    lats = [p1[0] + (p2[0] - p1[0]) * i / steps for i in range(steps)]
    lngs = [p1[1] + (p2[1] - p1[1]) * i / steps for i in range(steps)]
    return [[lat, lng] for lat, lng in zip(lats, lngs)]

if __name__ == "__main__":
    print("=" * 70)
    print(" [내장 라이브러리 전용] 서울 버스 시뮬레이터 HTML 생성 중...")
    print("=" * 70)

    full_animation_path = []
    station_indices = {}

    for u, v in edges:
        path = interpolate_points(coords[u], coords[v], steps=20)
        current_idx = len(full_animation_path)
        if u not in station_indices:
            station_indices[u] = current_idx
        full_animation_path.extend(path)
        if v not in station_indices:
            station_indices[v] = len(full_animation_path) - 1

    json_coords = json.dumps(coords, ensure_ascii=False)
    json_path = json.dumps(full_animation_path)
    json_stations = json.dumps(station_indices, ensure_ascii=False)

    html_template = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>서울 버스 병목 시뮬레이션</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; font-family: 'Malgun Gothic', sans-serif; }
        #control-panel {
            position: absolute; top: 15px; right: 15px; z-index: 10000;
            background: rgba(255, 255, 255, 0.95); padding: 15px; border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); width: 320px;
        }
        #table-panel {
            position: absolute; bottom: 20px; left: 20px; z-index: 10000;
            background: rgba(255, 255, 255, 0.95); padding: 12px; border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); max-height: 250px; overflow-y: auto; width: 420px;
        }
        .mode-btn { width: 100%; padding: 10px; margin-top: 5px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-off { background: #e74c3c; color: white; }
        .btn-on { background: #2ecc71; color: white; }
        .btn-reset { background: #3498db; color: white; }
        .btn-active { border: 3px solid #2c3e50; transform: scale(1.02); }
        .slider-container { margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; }
        th, td { padding: 5px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; position: sticky; top: 0; }
        .station-link { color: #2980b9; cursor: pointer; text-decoration: underline; font-weight: bold; }
        .station-link:hover { color: #c0392b; }
        .risk-high { color: red; font-weight: bold; }
        .risk-low { color: green; font-weight: bold; }
        .bus-label {
            background: rgba(0, 0, 0, 0.75); color: #ffffff; font-size: 10px; font-weight: bold;
            padding: 2px 5px; border-radius: 4px; white-space: nowrap; border: 1px solid #ffffff;
        }
    </style>
</head>
<body>
    <div id="map"></div>

    <div id="control-panel">
        <h3 style="margin:0 0 8px 0; font-size:16px;">🚍 서울 버스 병목 시뮬레이션</h3>
        <p style="font-size:11px; color:#555; margin-bottom:8px;">운행 버스: <b>35대</b> | 정류장 정차: <b>25초</b></p>
        <button id="btn-mode-off" class="mode-btn btn-off btn-active" onclick="window.setMode(false)">❌ 4색 정리 미적용 (모든 정류장 정차)</button>
        <button id="btn-mode-on" class="mode-btn btn-on" onclick="window.setMode(true)">✅ 4색 정리 적용 (정류장 역할 분산)</button>
        <button id="btn-reset" class="mode-btn btn-reset" onclick="window.resetSimulation()">🔄 시뮬레이션 위치 초기화</button>
        <div class="slider-container">
            <div style="font-size:12px; font-weight:bold;">⚡ 시뮬레이션 배속: <span id="speed-val">15x</span></div>
            <input type="range" id="speed-slider" min="1" max="50" value="15" style="width:100%; margin-top:5px;" oninput="window.updateSpeed(this.value)">
        </div>
        <div id="status-info" style="margin-top:8px; font-size:11px; line-height:1.4;"></div>
    </div>

    <div id="table-panel">
        <h4 style="margin:0 0 8px 0; font-size:13px;">📊 실시간 정류장 병목 데이터 <span style="font-size:10px; color:#777;">(클릭시 시점 이동)</span></h4>
        <table>
            <thead>
                <tr><th>정류장명</th><th>기본 정차</th><th>실시간 대기 지연</th><th>병목 상태</th></tr>
            </thead>
            <tbody id="bottleneck-tbody"></tbody>
        </table>
    </div>

    <script>
        var map = L.map('map').setView([37.5500, 126.9800], 11);
        
        L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
            maxZoom: 18, attribution: 'Vworld Base Map'
        }).addTo(map);

        var coordsMap = __DATA_COORDS__;
        var path = __DATA_PATH__;
        var stationIndices = __DATA_STATIONS__;

        for (var name in coordsMap) {
            var pos = coordsMap[name];
            var isHub = ["충무로역", "강남역", "서울역", "종로3가역", "신촌역", "잠실역", "청량리역", "사당역"].indexOf(name) !== -1;
            var marker = L.circleMarker(pos, {
                radius: isHub ? 7 : 5, fillColor: isHub ? "#e74c3c" : "#2980b9", color: "#ffffff", weight: 2, fillOpacity: 1
            }).addTo(map);
            marker.bindPopup("<b>정류장: " + name + "</b>");
        }

        L.polyline(path, { color: '#777777', weight: 3, opacity: 0.5 }).addTo(map);

        var use4Color = false;
        var numBuses = 35;
        var buses = [];
        var stationState = {};
        var stationWaitingMap = {};
        var simSpeed = 15;

        for (var st in stationIndices) {
            stationState[st] = { activeBusId: null, remainingDwellSec: 0 };
            stationWaitingMap[st] = {};
        }

        for (var i = 0; i < numBuses; i++) {
            var routeGroup = i % 4;
            var startIdx = Math.floor((path.length / numBuses) * i);
            var marker = L.circleMarker(path[startIdx], {
                radius: 7, fillColor: "#888888", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.95
            }).addTo(map);

            marker.bindTooltip(L.tooltip({ permanent: true, direction: 'top', className: 'bus-label', offset: [0, -5] })).openTooltip();

            buses.push({
                id: i + 1,
                routeGroup: routeGroup,
                marker: marker,
                currentIndex: startIdx,
                dwellTimerSec: 0,
                waitingTimeSec: 0,
                waitingAtStation: null,
                lastStation: null
            });
        }

        window.focusStation = function(stName) {
            if (coordsMap[stName]) {
                map.setView(coordsMap[stName], 15, { animate: true });
            }
        };

        window.resetSimulation = function() {
            for (var st in stationIndices) {
                stationState[st] = { activeBusId: null, remainingDwellSec: 0 };
                stationWaitingMap[st] = {};
            }

            buses.forEach(function(bus, i) {
                var newIdx = Math.floor((path.length / numBuses) * i);
                bus.currentIndex = newIdx;
                bus.dwellTimerSec = 0;
                bus.waitingTimeSec = 0;
                bus.waitingAtStation = null;
                bus.lastStation = null;
                bus.marker.setLatLng(path[newIdx]);

                var palette = ["#FF2A2A", "#2A55FF", "#2AFF55", "#AA2AFF"];
                var assignedColor = use4Color ? palette[bus.routeGroup] : "#888888";
                bus.marker.setStyle({ fillColor: assignedColor, color: "#ffffff", radius: 7 });
                bus.marker.setTooltipContent("버스 #" + bus.id);
            });
        };

        window.setMode = function(is4ColorOn) {
            use4Color = is4ColorOn;
            var btnOff = document.getElementById('btn-mode-off');
            var btnOn = document.getElementById('btn-mode-on');
            if (btnOff) btnOff.classList.toggle('btn-active', !is4ColorOn);
            if (btnOn) btnOn.classList.toggle('btn-active', is4ColorOn);
            window.resetSimulation();

            var statusDiv = document.getElementById('status-info');
            if (statusDiv) {
                statusDiv.innerHTML = is4ColorOn ?
                    "<b style='color:green;'>[4색 정리 ON]</b> 버스들이 역할에 맞는 정류장에만 정차하여 병목 해소!" :
                    "<b style='color:red;'>[4색 정리 OFF]</b> 모든 버스가 모든 정류장에 정차하여 집중 병목 발생!";
            }
        };

        window.updateSpeed = function(val) {
            simSpeed = parseInt(val);
            var spVal = document.getElementById('speed-val');
            if (spVal) spVal.innerText = simSpeed + "x";
        };

        window.setMode(false);

        var dtSec = 0.1;
        setInterval(function() {
            var effectiveDt = dtSec * simSpeed;

            for (var st in stationState) {
                if (stationState[st].remainingDwellSec > 0) {
                    stationState[st].remainingDwellSec -= effectiveDt;
                    if (stationState[st].remainingDwellSec <= 0) {
                        stationState[st].activeBusId = null;
                        stationState[st].remainingDwellSec = 0;
                    }
                }
            }

            buses.forEach(function(bus) {
                if (bus.dwellTimerSec > 0) {
                    bus.dwellTimerSec -= effectiveDt;
                    var remainSec = Math.max(0, bus.dwellTimerSec).toFixed(1);
                    bus.marker.setTooltipContent("버스 #" + bus.id + "<br>⏳ 정차: " + remainSec + "초");
                    
                    if (bus.dwellTimerSec <= 0) {
                        if (bus.waitingAtStation && stationState[bus.waitingAtStation].activeBusId === bus.id) {
                            stationState[bus.waitingAtStation].activeBusId = null;
                        }
                        bus.waitingAtStation = null;
                    }
                    return;
                }

                var nextIndex = (bus.currentIndex + 1) % path.length;
                
                var currentStation = null;
                for (var st in stationIndices) {
                    if (Math.abs(stationIndices[st] - nextIndex) <= 1) {
                        currentStation = st;
                        break;
                    }
                }

                if (currentStation === bus.lastStation) {
                    currentStation = null;
                } else if (currentStation !== null) {
                    bus.lastStation = null;
                }

                if (currentStation) {
                    var stInfo = stationState[currentStation];
                    var isMyAssignedStation = !use4Color || (currentStation.length % 4 === bus.routeGroup);

                    if (isMyAssignedStation) {
                        if (stInfo.activeBusId !== null && stInfo.activeBusId !== bus.id) {
                            bus.waitingAtStation = currentStation;
                            bus.waitingTimeSec += effectiveDt;
                            stationWaitingMap[currentStation][bus.id] = bus.waitingTimeSec;
                            
                            bus.marker.setStyle({ fillColor: "#FF0000", color: "#FFFF00", radius: 9 });
                            bus.marker.setTooltipContent("버스 #" + bus.id + "<br>🔴 병목 대기");
                            return; 
                        }

                        if (stInfo.activeBusId === null) {
                            if (bus.waitingAtStation) {
                                delete stationWaitingMap[bus.waitingAtStation][bus.id];
                            }
                            stInfo.waitingAtStation = null;
                            stInfo.waitingTimeSec = 0;
                            
                            stInfo.activeBusId = bus.id;
                            stInfo.remainingDwellSec = 25.0;
                            bus.dwellTimerSec = 25.0;
                            bus.lastStation = currentStation;
                            
                            bus.marker.setTooltipContent("버스 #" + bus.id + "<br>⏳ 정차: 25.0초");
                            return;
                        }
                    }
                }

                if (bus.waitingAtStation) {
                    delete stationWaitingMap[bus.waitingAtStation][bus.id];
                    bus.waitingAtStation = null;
                }
                bus.waitingTimeSec = 0;
                bus.currentIndex = nextIndex;
                bus.marker.setLatLng(path[bus.currentIndex]);

                var palette = ["#FF2A2A", "#2A55FF", "#2AFF55", "#AA2AFF"];
                var assignedColor = use4Color ? palette[bus.routeGroup] : "#888888";
                bus.marker.setStyle({ fillColor: assignedColor, color: "#ffffff", radius: 7 });
                bus.marker.setTooltipContent("버스 #" + bus.id);
            });

            var tbody = document.getElementById('bottleneck-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                var realTimeStationWait = {};
                for (var st in stationIndices) {
                    var totalWait = 0;
                    for (var bId in stationWaitingMap[st]) {
                        totalWait += stationWaitingMap[st][bId];
                    }
                    realTimeStationWait[st] = totalWait;
                }

                var sortedStations = Object.keys(realTimeStationWait).sort(function(a,b) {
                    return realTimeStationWait[b] - realTimeStationWait[a];
                }).slice(0, 8);

                sortedStations.forEach(function(st) {
                    var waitSec = realTimeStationWait[st].toFixed(1);
                    var isHighRisk = realTimeStationWait[st] > 5.0;
                    
                    var tr = document.createElement('tr');
                    var td1 = document.createElement('td');
                    var span = document.createElement('span');
                    span.className = 'station-link';
                    span.textContent = st;
                    span.onclick = function() { window.focusStation(st); };
                    td1.appendChild(span);
                    
                    var td2 = document.createElement('td');
                    td2.textContent = '25.0초';
                    
                    var td3 = document.createElement('td');
                    td3.style.color = waitSec > 0 ? 'red' : 'black';
                    td3.style.fontWeight = 'bold';
                    td3.textContent = waitSec + '초';
                    
                    var td4 = document.createElement('td');
                    td4.className = isHighRisk ? 'risk-high' : 'risk-low';
                    td4.textContent = isHighRisk ? '🔴 심각 (병목)' : '🟢 원활';
                    
                    tr.appendChild(td1);
                    tr.appendChild(td2);
                    tr.appendChild(td3);
                    tr.appendChild(td4);
                    tbody.appendChild(tr);
                });
            }
        }, 100);
    </script>
</body>
</html>"""

    html_final = html_template.replace("__DATA_COORDS__", json_coords).replace("__DATA_PATH__", json_path).replace("__DATA_STATIONS__", json_stations)

    with open("seoul_bus_4color_comparison.html", "w", encoding="utf-8") as f:
        f.write(html_final)

    print("\n[성공] 외부 모듈 의존성 없는 독립형 시뮬레이터 HTML 생성 완료!")