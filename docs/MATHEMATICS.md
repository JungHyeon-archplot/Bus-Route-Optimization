# 수학 공식과 적용 위치

## 그래프와 이동시간

$$G=(V,E),\quad t_e=\ell_e/v$$

V는 정류장·교차로, E는 통행 가능한 구간입니다. 길이는 m, 시간은 s로 통일합니다.
실제 도로는 방향을 보존합니다. 좌표 배열의 몇 칸을 움직이는 방식은 사용하지 않습니다.

## 오일러 회로

연결된 무방향 그래프에서 모든 정점의 차수가 짝수이면 모든 간선을 한 번씩 지나 돌아옵니다.

$$\deg(v)\equiv0\pmod2\quad(\forall v\in V)$$

차수는 연결된 간선 수입니다. 방향 그래프의 진입·진출 및 연결 조건은 별도입니다.
이 조건으로 버스 대수나 배차 간격이 정해지는 것은 아닙니다.

## 다익스트라

$$d(v)\leftarrow\min\{d(v),d(u)+w(u,v)\}$$

출발점 0, 나머지 무한대로 시작하고 가장 가까운 미확정 정점부터 갱신합니다.
음수 가중치를 허용하지 않습니다. 거점 간 최단경로와 아래 추가 운행 비용에 사용합니다.

## 무방향 중국인 우체부 문제

$$L^*=\sum_{e\in E}w_e+\min_M\sum_{(u,v)\in M}d(u,v)$$

M은 홀수 차수 정점 전체를 둘씩 짝짓는 완전 매칭입니다. 연결된 무방향 그래프에서 모든
간선이 필수일 때 적용합니다. 작은 모델에서는 모든 짝짓기를 비교해 최소 비용을 선택하고,
선택된 최단경로를 복제한 뒤 Hierholzer 방식으로 순회를 구성합니다.

가상 AB=2, BC=2, CD=3, DE=2, EF=3, FA=4, AC=3분이면 합 19분,
홀수 A·C 사이 추가 3분으로 최소 22분입니다. A-B-C-D-E-F-A-C-A가 가능합니다.
38분(모든 간선을 두 번) 대비 42.1% 감소는 실제 버스 개선율이 아닙니다.

일부 간선만 필수이거나 정점만 방문하는 문제에는 이 기본 공식을 그대로 쓰지 않습니다.
현재 구현은 작은 무방향 교육 예제이며 실제 방향 노선망 적용은 후속입니다.

## 그래프 색칠과 4색 정리

$$c(u)\ne c(v)\quad\forall(u,v)\in E_c$$

충돌 그래프의 정점은 운행, 간선은 같은 자원을 동시에 이용할 가능성입니다.
도로 그래프와 의미가 다릅니다. $\chi(G)\le4$는 평면 그래프에서만 보장됩니다.

데모는 동시에 출발하는 세 운행의 K3 충돌 예제를 색칠하고 3색을
0·240·480초의 후보 시간표로 연결한 뒤 시뮬레이션에서 검증합니다.
색칠만으로 모든 정류장의 시간 충돌이 해소되는 것은 아닙니다.
일반 입력에 네 색을 강제하지 않고 K5는 다섯 색을 사용합니다.

## 배차와 차량 수

$$T=T_{drive}+T_{dwell}+T_{recovery},\quad h=T/N,\quad N_{min}=\lceil T/h_{target}\rceil$$

36분 순환에 3대를 균등 배치하면 12분 간격입니다. 목표 10분에는 최소 4대가 필요합니다.
운전자·수요·정원 조건은 추가 검토합니다.

데모는 같은 순환 경로의 세 운행 그룹에 차량 1대씩을 배정합니다. 차량마다 720초 주기의
계획 출발을 가지고, 주행 540초+정차 150초=690초 뒤 복귀합니다.
지연으로 계획 출발을 지킬 수 없으면 실제 복귀 이후로 미룹니다. 차량을 복제하지 않습니다.

## 정류장 대기열

$$s_i=\max(a_i,f_{i-1}),\quad f_i=s_i+D,\quad q_i=s_i-a_i$$

a는 도착, s는 정차 시작, f는 종료, D는 정차시간, q는 버스 진입 대기입니다.
단일 정차면의 FIFO 모델이며 동시 도착은 고정 차량 ID 순으로 처리합니다.

평균 버스 지연 $\bar q=\sum_iq_i/n$은 관측창 안에 도착한 버스를 기준으로 계산합니다.
정차 후 기록을 지우지 않습니다. 처리 건수·정류장별 서비스도 함께 표시합니다.

## 승객 대기

무작위 일정 도착률, 모든 운행을 이용할 수 있고 다음 차량에 탑승 가능한 조건:

$$E(W)=h/2$$
$$E(W)=\frac{E(H^2)}{2E(H)}=\frac{\mu_H}{2}+\frac{\sigma_H^2}{2\mu_H}$$

12분마다 세 대가 함께 오면 이상적 평균 6분, 4분 간격이면 2분입니다.
특정 노선만 이용하는 승객·만차·환승·시간표를 보고 오는 승객에는 그대로 적용하지 않습니다.

데모는 실제 계산된 정차 시작 시계열에 대해 관측창의 이론 대기를 적분합니다.

$$\bar W=\frac1{b-a}\int_a^b(t_{next}(t)-t)\,dt$$

창 끝 이후의 다음 서비스도 계산하여 마지막 구간을 누락하지 않습니다.
정류장마다 동일 승객 도착률을 가정한 이론값이며 실제 승객 측정치가 아닙니다.

## 보로노이 후속 단계

$$R_i=\{x\mid d(x,p_i)\le d(x,p_j),\ \forall j\}$$

가장 가까운 정류장의 접근 영역입니다. 실제 보행망·언덕·횡단보도를 반영해야 합니다.
MVP에는 미구현이며 후속 이슈로 둡니다.

## 근거

- [오일러 회로](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.euler.is_eulerian.html)
- [다익스트라](https://networkx.org/documentation/latest/reference/algorithms/shortest_paths/dijkstra.html)
- [중국인 우체부 문제](https://jgrapht.org/javadoc/org.jgrapht.core/org/jgrapht/alg/cycle/ChinesePostman.html)
- [평면 그래프 색칠](https://opentext.uleth.ca/Combinatorics/sect_planar-MapColouring.html)
- [MIT 배차 공식](https://ocw.mit.edu/courses/1-258j-public-transportation-systems-spring-2017/72f76e8edf796853c9fbcf45732e818c_MIT1_258JS17_HW1.pdf)
- [National Academies 대기시간](https://www.nationalacademies.org/read/25085/chapter/12)
- [CGAL 보로노이](https://doc.cgal.org/latest/Voronoi_diagram_2/index.html)
