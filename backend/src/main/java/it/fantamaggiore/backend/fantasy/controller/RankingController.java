package it.fantamaggiore.backend.fantasy.controller;

import it.fantamaggiore.backend.fantasy.dto.LeagueRankingDTO;
import it.fantamaggiore.backend.fantasy.dto.RankingDTO;
import it.fantamaggiore.backend.fantasy.service.FantasyMatchService;
import it.fantamaggiore.backend.fantasy.service.RankingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rankings")
public class RankingController {

    @Autowired
    private RankingService rankingService;

    @Autowired
    private FantasyMatchService fantasyMatchService;

    @GetMapping("/global")
    public ResponseEntity<List<RankingDTO>> getGlobalRanking(){
        return ResponseEntity.ok(rankingService.getGlobalRanking());
    }

    @GetMapping("/league")
    public ResponseEntity<List<LeagueRankingDTO>> getLeagueRanking(){
        return ResponseEntity.ok(fantasyMatchService.getLeagueRanking());
    }

    @PostMapping("/generate-calendar")
    public ResponseEntity<String> generateCalendar(){
        fantasyMatchService.generateCalendar();
        return ResponseEntity.ok("Calendar generated successfully");
    }

}
