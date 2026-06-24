package it.fantamaggiore.backend.fantasy.controller;

import it.fantamaggiore.backend.fantasy.dto.VoteResponseDTO;
import it.fantamaggiore.backend.fantasy.mapper.VoteMapper;
import it.fantamaggiore.backend.fantasy.service.VoteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/votes")
public class VoteController {

    @Autowired
    private VoteService voteService;

    @Autowired
    private VoteMapper voteMapper;

    // 1. LE PAGELLE DELLA GIORNATA (Es. Tutti i voti della Giornata 1)
    @GetMapping("/matchday/{matchDayId}")
    public ResponseEntity<List<VoteResponseDTO>> getVotesByMatchDay(@PathVariable Long matchDayId) {
        List<VoteResponseDTO> votesDTO = voteService.getVotesByMatchDay(matchDayId).stream()
                .map(voteMapper::toDTO)
                .toList();
        return ResponseEntity.ok(votesDTO);
    }

    // 2. LO STORICO DEL GIOCATORE (Per vedere l'andamento durante il torneo)
    @GetMapping("/player/{playerId}")
    public ResponseEntity<List<VoteResponseDTO>> getVotesByPlayer(@PathVariable Long playerId) {
        List<VoteResponseDTO> votesDTO = voteService.getVotesByPlayer(playerId).stream()
                .map(voteMapper::toDTO)
                .toList();
        return ResponseEntity.ok(votesDTO);
    }
}