package it.fantamaggiore.backend.fantasy.controller;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.fantasy.dto.BetRequestDTO;
import it.fantamaggiore.backend.fantasy.dto.BetResponseDTO;
import it.fantamaggiore.backend.fantasy.mapper.BetMapper;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.enums.BetStatus;
import it.fantamaggiore.backend.fantasy.model.enums.PredictionType;
import it.fantamaggiore.backend.fantasy.service.BetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bets")
public class BetController {

    @Autowired private UserService userService;
    @Autowired private MatchDayService matchDayService;
    @Autowired private BetMapper betMapper;
    @Autowired private BetService betService;

    @PostMapping()
    public ResponseEntity<BetResponseDTO> createBet(Authentication authentication, @RequestBody BetRequestDTO betDTO){
        Bet bet = betService.createBet(authentication.getName(), betDTO.getMatchDayId(), betDTO.getDescription());
        User currentUser = userService.getUserByEmail(authentication.getName());
        return ResponseEntity.ok(betMapper.toDTO(bet, currentUser));
    }

    @PostMapping("/{betId}/predict")
    public ResponseEntity<String> placePrediction(@PathVariable Long betId, Authentication authentication, @RequestBody Map<String, String> payload){
        PredictionType type = PredictionType.valueOf(payload.get("type"));
        betService.placePrediction(betId, authentication.getName(), type);
        return ResponseEntity.ok("Prediction placed");
    }

    @PutMapping("/{betId}/resolve/{status}")
    public ResponseEntity<String> resolveBet(@PathVariable Long betId, @PathVariable BetStatus status, Authentication authentication){
        // 🔥 FIX: Controlliamo se in tutti i permessi c'è la parola "ADMIN"
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().toUpperCase().contains("ADMIN"));

        betService.resolveBet(betId, status, isAdmin);
        return ResponseEntity.ok("Bet resolved successfully");
    }

    @GetMapping("/matchday/{matchDayId}")
    public ResponseEntity<List<BetResponseDTO>> getBetsByMatchDay(@PathVariable Long matchDayId, Authentication authentication) {
        User currentUser = userService.getUserByEmail(authentication.getName());
        List<BetResponseDTO> bets = betService.getBetsByMatchDay(matchDayId).stream()
                .map(bet -> betMapper.toDTO(bet, currentUser))
                .toList();
        return ResponseEntity.ok(bets);
    }

    @PutMapping("/{betId}")
    public ResponseEntity<BetResponseDTO> updateBet(Authentication authentication, @PathVariable Long betId, @RequestBody BetRequestDTO betDTO){
        Bet bet = betService.updateBetDescription(betId, betDTO.getDescription(), authentication.getName());
        User currentUser = userService.getUserByEmail(authentication.getName());
        return ResponseEntity.ok(betMapper.toDTO(bet, currentUser));
    }

    @DeleteMapping("/{betId}")
    public ResponseEntity<String> deleteBet(Authentication authentication, @PathVariable Long betId){
        String email = authentication.getName();
        // 🔥 FIX: Stesso controllo robusto per l'eliminazione
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().toUpperCase().contains("ADMIN"));

        betService.deleteBet(betId, email, isAdmin);
        return ResponseEntity.ok("Bet deleted successfully");
    }

    @GetMapping("/me")
    public ResponseEntity<List<BetResponseDTO>> getMyBets(Authentication authentication) {
        User currentUser = userService.getUserByEmail(authentication.getName());
        List<BetResponseDTO> myBets = betService.getMyBets(authentication.getName()).stream()
                .map(bet -> betMapper.toDTO(bet, currentUser))
                .toList();
        return ResponseEntity.ok(myBets);
    }

    @DeleteMapping("/{betId}/predict")
    public ResponseEntity<String> removePrediction(@PathVariable Long betId, Authentication authentication){
        betService.removePrediction(betId, authentication.getName());
        return ResponseEntity.ok("Prediction removed");
    }
}