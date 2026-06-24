package it.fantamaggiore.backend.tournament.mapper;

import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.tournament.dto.TournamentTeamRequestDTO;
import it.fantamaggiore.backend.tournament.dto.TournamentTeamResponseDTO;
import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import org.springframework.stereotype.Component;

@Component
public class TournamentTeamMapper {

    public TournamentTeamResponseDTO toDTO (TournamentTeam team){
        if (team == null) return null;

        TournamentTeamResponseDTO teamDTO = new TournamentTeamResponseDTO();
        teamDTO.setId(team.getId());
        teamDTO.setTeamName(team.getTeamName());
        teamDTO.setGoalDifference(team.getGoalDifference());
        teamDTO.setPoints(team.getPoints());
        teamDTO.setGoalsScored(team.getGoalsScored());
        teamDTO.setGoalsConceded(team.getGoalsConceded());
        if (team.getCaptain() != null){
            teamDTO.setIdCaptain(team.getCaptain().getId());
        }
        if (team.getMatchDay() != null){
            teamDTO.setIdMatchDay(team.getMatchDay().getId());
        }
        if (team.getPlayers() != null){
            teamDTO.setPlayerIds(team.getPlayers().stream()
                    .map(Player::getId)
                    .toList());
        }

        return teamDTO;
    }

    // Traduce il DTO in Entity (per la creazione)
    public TournamentTeam toEntity(TournamentTeamRequestDTO dto) {
        if (dto == null) return null;

        TournamentTeam team = new TournamentTeam();
        team.setTeamName(dto.getTeamName());
        return team;
    }
}
