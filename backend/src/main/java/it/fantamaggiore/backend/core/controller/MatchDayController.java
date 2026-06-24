package it.fantamaggiore.backend.core.controller;

import it.fantamaggiore.backend.core.dto.MatchDayRequestDTO;
import it.fantamaggiore.backend.core.dto.MatchDayResponseDTO;
import it.fantamaggiore.backend.core.dto.PlayerResponseDTO;
import it.fantamaggiore.backend.core.mapper.MatchDayMapper;
import it.fantamaggiore.backend.core.mapper.PlayerMapper;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.service.MatchDayService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/matchdays")
public class MatchDayController {

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private MatchDayMapper matchDayMapper;

    @Autowired
    private PlayerMapper playerMapper;

    @GetMapping
    public ResponseEntity<List<MatchDayResponseDTO>> getAll(){
        List<MatchDay> matchDays = matchDayService.getAll();
        List<MatchDayResponseDTO> matchDaysDTO = matchDays.stream()
                .map(matchDayMapper :: toDTO)
                .toList();

        return ResponseEntity.ok(matchDaysDTO);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MatchDayResponseDTO> getMatchDayById(@PathVariable Long id){
        MatchDay matchDay = matchDayService.getMatchDayById(id);
        return ResponseEntity.ok(matchDayMapper.toDTO(matchDay));
    }

    @PostMapping
    public ResponseEntity<MatchDayResponseDTO> createMatchDay(@RequestBody MatchDayRequestDTO dto) {
        MatchDay matchDay = matchDayMapper.toEntity(dto);
        // Passiamo anche i playerIds al Service
        MatchDay created = matchDayService.createMatchDay(matchDay, dto.getPlayerIds());
        return ResponseEntity.ok(matchDayMapper.toDTO(created));
    }

    @PutMapping("/{id}/available-players")
    public ResponseEntity<String> addAvailablePlayers(@PathVariable Long id, @RequestBody List<Long> availablePlayerIds){
        matchDayService.setAvailablePlayers(id, availablePlayerIds);
        return ResponseEntity.ok("Available players updated successfully");
    }

    @PutMapping("/{id}/open")
    public ResponseEntity<String> openMatchDay(@PathVariable Long id){
        matchDayService.openMatchDay(id);
        return ResponseEntity.ok("Match day opened and base votes generated successfully");
    }

    @PutMapping("/{id}/calculate")
    public ResponseEntity<String> calculateMatchDayResults(@PathVariable Long id){
        matchDayService.calculateAllLineups(id);
        return ResponseEntity.ok("Results for this match day calculated");
    }

    @PutMapping("/{id}/rollback")
    public ResponseEntity<String> rollbackMatchDay(@PathVariable Long id){
        matchDayService.rollbackMatchDay(id);
        return ResponseEntity.ok("Rollback completed: the match day is LIVE again.");
    }

    @PutMapping("/{id}")
    public ResponseEntity<MatchDayResponseDTO> updateMatchDay(@PathVariable Long id, @RequestBody MatchDayRequestDTO dto){
        MatchDay updated = matchDayService.updateMatchDay(id, matchDayMapper.toEntity(dto), dto.getPlayerIds());
        return ResponseEntity.ok(matchDayMapper.toDTO(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMatchDay(@PathVariable Long id){
        matchDayService.deleteMatchDay(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/current")
    public ResponseEntity<MatchDayResponseDTO> getCurrentMatchDay() {
        MatchDay current = matchDayService.getCurrentOpenMatchDay();
        return ResponseEntity.ok(matchDayMapper.toDTO(current));
    }

    @GetMapping("/{id}/available-players")
    public ResponseEntity<List<PlayerResponseDTO>> getAvailablePlayers(@PathVariable Long id) {
        MatchDay matchDay = matchDayService.getMatchDayById(id);
        List<PlayerResponseDTO> players = matchDay.getAvailablePlayers().stream()
                .map(playerMapper::toDTO)
                .toList();
        return ResponseEntity.ok(players);
    }

}
