package it.fantamaggiore.backend.fantasy.mapper;

import it.fantamaggiore.backend.fantasy.dto.VoteResponseDTO;
import it.fantamaggiore.backend.fantasy.model.Vote;
import org.springframework.stereotype.Component;

@Component
public class VoteMapper {

    public VoteResponseDTO toDTO (Vote vote){
        if (vote == null) return null;

        VoteResponseDTO voteDTO = new VoteResponseDTO();
        voteDTO.setId(vote.getId());
        voteDTO.setBaseVote(vote.getBaseVote());
        voteDTO.setFantaVote(vote.getFantaVote());
        voteDTO.setBonus(vote.getBonus());
        voteDTO.setMalus(vote.getMalus());
        if (vote.getPlayer() != null){
            voteDTO.setIdPlayer(vote.getPlayer().getId());
        }
        if (vote.getMatchDay() != null){
            voteDTO.setIdMatchDay(vote.getMatchDay().getId());
        }

        voteDTO.setGoals(vote.getGoals());
        voteDTO.setAssists(vote.getAssists());
        voteDTO.setOwnGoals(vote.getOwnGoals());

        return voteDTO;
    }
}
