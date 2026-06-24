package it.fantamaggiore.backend.fantasy.controller;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.fantasy.dto.FantasyMatchResponseDTO;
import it.fantamaggiore.backend.fantasy.mapper.FantasyMatchMapper;
import it.fantamaggiore.backend.fantasy.model.FantasyMatch;
import it.fantamaggiore.backend.fantasy.service.FantasyMatchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fantasy-matches")
public class FantasyMatchController {

    @Autowired
    private FantasyMatchService fantasyMatchService;

    @Autowired
    private FantasyMatchMapper fantasyMatchMapper;

    @Autowired
    private UserService userService;

    @GetMapping("/matchday/{matchDayId}")
    public ResponseEntity<List<FantasyMatchResponseDTO>> getMatchesByMatchDay(@PathVariable Long matchDayId) {

        List<FantasyMatchResponseDTO> matchesDTO = fantasyMatchService.getFantasyMatchesByMatchDayId(matchDayId)
                .stream()
                .map(fantasyMatchMapper::toDTO)
                .toList();

        return ResponseEntity.ok(matchesDTO);
    }


    @GetMapping("/me/last-matches")
    public ResponseEntity<List<FantasyMatchResponseDTO>> getLastMatches(Authentication authentication) {
        // 1. Capiamo chi sta facendo la richiesta leggendo il Token
        User user = userService.getUserByEmail(authentication.getName());

        // 2. Cerchiamo solo le SUE ultime partite
        List<FantasyMatch> matches = fantasyMatchService.getMyLastMatches(user.getId());

        // 3. Le trasformiamo in DTO per il frontend
        List<FantasyMatchResponseDTO> dtos = matches.stream()
                .map(fantasyMatchMapper::toDTO)
                .toList();

        return ResponseEntity.ok(dtos);
    }
}