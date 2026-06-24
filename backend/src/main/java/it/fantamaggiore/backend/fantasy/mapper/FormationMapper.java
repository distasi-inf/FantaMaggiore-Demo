package it.fantamaggiore.backend.fantasy.mapper;

import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.fantasy.dto.FormationResponseDTO;
import it.fantamaggiore.backend.fantasy.dto.VoteResponseDTO;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.repository.VoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class FormationMapper {

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private VoteMapper voteMapper;

    public FormationResponseDTO toDTO(Formation formation) {
        if (formation == null) return null;

        FormationResponseDTO dto = new FormationResponseDTO();
        dto.setId(formation.getId());
        dto.setTotalScore(formation.getTotalScore());
        dto.setCarriedOver(formation.isCarriedOver());

        if (formation.getUser() != null) {
            dto.setUserId(formation.getUser().getId());
        }
        if (formation.getMatchDay() != null) {
            dto.setMatchDayId(formation.getMatchDay().getId());
        }

        // (Mappatura ID per il frontend)
        if (formation.getStarters() != null) {
            dto.setStarterIds(formation.getStarters().stream()
                    .map(Player::getId)
                    .toList());
        }

        if (formation.getSubstitutePlayer() != null) {
            dto.setSubId(formation.getSubstitutePlayer().getId());
        }

        // 1. RECUPERO VOTI LIVE DEI TITOLARI
        if (formation.getStarters() != null && formation.getMatchDay() != null) {
            List<VoteResponseDTO> starterVotes = formation.getStarters().stream()
                    .map(player -> voteRepository.findByPlayerIdAndMatchDayId(player.getId(), formation.getMatchDay().getId())
                            .map(voteMapper::toDTO)
                            .orElse(null))
                    .toList();
            dto.setStarterVotes(starterVotes);
        }

        // 2. RECUPERO VOTO LIVE DEL PANCHINARO
        if (formation.getSubstitutePlayer() != null && formation.getMatchDay() != null) {
            VoteResponseDTO subVoteDTO = voteRepository.findByPlayerIdAndMatchDayId(
                            formation.getSubstitutePlayer().getId(), formation.getMatchDay().getId())
                    .map(voteMapper::toDTO)
                    .orElse(null);
            dto.setSubVote(subVoteDTO);
        }

        return dto;
    }
}