package it.fantamaggiore.backend.tournament.controller;

import it.fantamaggiore.backend.tournament.dto.*;
import it.fantamaggiore.backend.tournament.mapper.MatchMapper;
import it.fantamaggiore.backend.tournament.mapper.TournamentTeamMapper;
import it.fantamaggiore.backend.tournament.model.Match;
import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import it.fantamaggiore.backend.tournament.service.MatchEventService;
import it.fantamaggiore.backend.tournament.service.TournamentMatchService;
import it.fantamaggiore.backend.tournament.service.TournamentTeamService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/tournaments")
public class TournamentController {

    // 1. INIETTIAMO I NUOVI SERVIZI DIVISI
    @Autowired
    private TournamentTeamService teamService;

    @Autowired
    private TournamentMatchService matchService;

    @Autowired
    private MatchEventService eventService;

    @Autowired
    private MatchMapper matchMapper;

    @Autowired
    private TournamentTeamMapper tournamentTeamMapper;

    // --- ENDPOINT SQUADRE ---

    @PostMapping("/teams")
    public ResponseEntity<TournamentTeamResponseDTO> createTournamentTeam(@RequestBody TournamentTeamRequestDTO tournamentTeamDTO){
        TournamentTeam team = tournamentTeamMapper.toEntity(tournamentTeamDTO);
        team = teamService.createTeam(team, tournamentTeamDTO.getIdMatchDay(), tournamentTeamDTO.getPlayerIds(), tournamentTeamDTO.getIdCaptain());
        return ResponseEntity.ok(tournamentTeamMapper.toDTO(team));
    }

    @PutMapping("/teams/{id}")
    public ResponseEntity<TournamentTeamResponseDTO> updateTeam(
            @PathVariable Long id,
            @Valid @RequestBody TournamentTeamRequestDTO requestDTO) {
        TournamentTeam updatedTeam = teamService.updateTeam(id, requestDTO);
        return ResponseEntity.ok(tournamentTeamMapper.toDTO(updatedTeam));
    }

    @DeleteMapping("/teams/{id}")
    public ResponseEntity<Void> deleteTournamentTeam(@PathVariable Long id) {
        teamService.deleteTeam(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/teams/matchday/{matchDayId}")
    public ResponseEntity<List<TournamentTeamResponseDTO>> getTeamsByMatchDay(@PathVariable Long matchDayId) {
        return ResponseEntity.ok(teamService.getTeamsByMatchDay(matchDayId));
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<TournamentRankingDTO>> getTournamentRanking(){
        return ResponseEntity.ok(teamService.getTournamentRanking());
    }

    // --- ENDPOINT PARTITE ---

    @PostMapping("/matches")
    public ResponseEntity<MatchResponseDTO> createMatch (@RequestBody MatchRequestDTO matchDTO){
        Match match = matchService.createMatch(matchDTO.getMatchDayId(), matchDTO.getHomeTeamId(), matchDTO.getAwayTeamId());
        return ResponseEntity.ok(matchMapper.toDTO(match));
    }

    @PutMapping("/matches/{id}/start")
    public ResponseEntity<?> startMatch(@PathVariable Long id, @RequestParam int duration){
        try {
            Match match = matchService.startMatch(id, duration);
            return ResponseEntity.ok(matchMapper.toDTO(match));
        } catch (Exception e) {
            // Stampiamo l'errore nel terminale Java
            e.printStackTrace();
            // E lo spariamo dritto al frontend per farti leggere cosa si è rotto!
            return ResponseEntity.internalServerError().body(Collections.singletonMap("message", "ERRORE BACKEND: " + e.getMessage() + " | Causa: " + e.getClass().getSimpleName()));
        }
    }

    @PutMapping("/matches/{id}/end")
    public ResponseEntity<String> endMatch (@PathVariable Long id){
        matchService.endMatch(id);
        return ResponseEntity.ok("Match ended");
    }

    @DeleteMapping("/matches/{id}")
    public ResponseEntity<Void> deleteMatch(@PathVariable Long id) {
        matchService.deleteMatch(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/matches/matchday/{matchDayId}")
    public ResponseEntity<List<MatchResponseDTO>> getMatchesByMatchDay(@PathVariable Long matchDayId) {
        return ResponseEntity.ok(matchService.getMatchesByMatchDay(matchDayId));
    }

    @PutMapping("/matches/{id}/guest-goalkeepers")
    public ResponseEntity<MatchResponseDTO> setGuestGoalkeepers(
            @PathVariable Long id,
            @RequestBody GuestGoalkeepersRequestDTO requestDTO) {

        Match match = matchService.setGuestGoalkeepers(
                id,
                requestDTO.getHomeGuestId(),
                requestDTO.getAwayGuestId()
        );
        return ResponseEntity.ok(matchMapper.toDTO(match));
    }

    // --- ENDPOINT EVENTI PARTITA ---

    @PostMapping("/matches/events")
    public ResponseEntity<MatchEventResponseDTO> addEvent(@RequestBody MatchEventRequestDTO requestDTO) {
        MatchEventResponseDTO response = eventService.addEvent(
                requestDTO.getMatchId(),
                requestDTO
        );
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/matches/events/{eventId}")
    public ResponseEntity<String> removeEvent(@PathVariable Long eventId) {
        eventService.removeEvent(eventId);
        return ResponseEntity.ok("Event removed and points restored successfully");
    }

    @GetMapping("/matches/{id}/events")
    public ResponseEntity<List<MatchEventResponseDTO>> getMatchEvents(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getMatchEvents(id));
    }

    @GetMapping("/ranking/matchday/{matchDayId}")
    public ResponseEntity<List<TournamentRankingDTO>> getTournamentRankingByMatchDay(@PathVariable Long matchDayId){
        return ResponseEntity.ok(teamService.getTournamentRankingByMatchDay(matchDayId));
    }
}