import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.adapters.rivalstracker import parse_rivalstracker_html

raw_sample_html = """
<html>
<body>
  <div class="lvl"><p data-v-cfd279cc="">92</p></div>
  <div class="informations"><h1>PlayerName<span>#1234</span></h1></div>
  <div class="rank-block">
    <div class="rank-title">Grandmaster I</div>
    <div>4,121 Score</div>
  </div>
  <div class="season_highest">
    <div class="rank-title">Grandmaster I</div>
    <div>4,510 Score</div>
  </div>
  <div class="profile-summary">
    <div class="profile-summary__cell"><div class="profile-summary__value">25W 15L</div><div class="profile-summary__sub"><b>62.5%</b> (40 matches)</div></div>
    <div class="profile-summary__cell"><div class="profile-summary__value font-high">6.56</div><div class="profile-summary__sub">18.4 / 4.2 / 9.1</div></div>
    <div class="profile-summary__cell--who"><div class="profile-summary__name">Jubilee</div></div>
    <div class="profile-summary__cell--who"><div class="profile-summary__name">Wild-Fox_09</div></div>
  </div>
  <div class="played-friend">
    <table><tbody>
      <tr>
        <td><a class="player" href="/profile/1001"><p>Wild-Fox_09</p></a></td>
        <td class="games_struct"><p>30 Matches</p><p>18W 12L</p></td>
        <td class="winrate_teammate">60.0%</td>
      </tr>
      <tr>
        <td><a class="player" href="/profile/1002"><p>SleeepylifeTTV</p></a></td>
        <td class="games_struct"><p>21 Matches</p><p>14W 7L</p></td>
        <td class="winrate_teammate">66.7%</td>
      </tr>
    </tbody></table>
  </div>
  <div class="match-history_match-card">
    <div class="queue-type">Competitive</div>
    <div class="from-now">10 mins ago</div>
    <div class="lp-value">+24</div>
    <div class="victory-status">WIN</div>
    <div class="game-duration">14:20</div>
    <div class="KDA-totals">24 / 4 / 18</div>
    <div class="KDA-ratio">10.50</div>
    <div class="group-score"><span class="value">2-0</span></div>
    <div class="map-card_name"><p>Lower Manhattan</p></div>
    <div class="mvp">MVP</div>
  </div>
</body>
</html>
"""

def test_parser():
    res = parse_rivalstracker_html(raw_sample_html)
    print("=== RIVALSTRACKER PARSER AUDIT ===")
    print(f"Level          : {res['level']} (Expected: 92)")
    print(f"Username       : {res['username']} {res['tag']}")
    print(f"Current Rank   : {res['rank']} ({res['rank_score']} Score)")
    print(f"Peak Rank      : {res['peak_rank']} ({res['peak_rank_score']} Score)")
    print(f"Season Summary : {res['summary']}")
    print(f"Teammates Count: {len(res['best_teammates'])} (First: {res['best_teammates'][0] if res['best_teammates'] else 'None'})")
    print(f"Matches Parsed : {len(res['match_history'])} (First: {res['match_history'][0] if res['match_history'] else 'None'})")
    
    assert res["level"] == 92, f"Failed to parse level 92, got {res['level']}"
    assert res["rank_score"] == 4121, f"Failed to parse rank score 4121, got {res['rank_score']}"
    assert len(res["best_teammates"]) >= 2, f"Failed to extract teammates, got {len(res['best_teammates'])}"
    assert len(res["match_history"]) >= 1, f"Failed to extract match history, got {len(res['match_history'])}"
    print("ALL PARSER ASSERTIONS PASSED.")

if __name__ == "__main__":
    test_parser()
