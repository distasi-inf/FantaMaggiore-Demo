package it.fantamaggiore.backend.tournament.mapper;

import it.fantamaggiore.backend.tournament.dto.MatchRequestDTO;
import it.fantamaggiore.backend.tournament.dto.MatchResponseDTO;
import it.fantamaggiore.backend.tournament.model.Match;
import org.springframework.stereotype.Component;

@Component
public class MatchMapper {

    public Match toEntity(MatchRequestDTO dto) {
        if (dto == null) return null;

        Match match = new Match();
        match.setStatus(it.fantamaggiore.backend.tournament.model.enums.MatchStatus.PRE);
        match.setHomeScore(0);
        match.setAwayScore(0);
        match.setStandingsUpdated(false);

        return match;
    }

    public MatchResponseDTO toDTO(Match match) {
        if (match == null) return null;

        MatchResponseDTO matchDTO = new MatchResponseDTO();
        matchDTO.setId(match.getId());
        matchDTO.setMatchStatus(match.getStatus());
        matchDTO.setAwayScore(match.getAwayScore());
        matchDTO.setHomeScore(match.getHomeScore());
        matchDTO.setEndTime(match.getEndTime());
        matchDTO.setStartTime(match.getStartTime());
        matchDTO.setActualDuration(match.getActualDuration());
        matchDTO.setExpectedDuration(match.getExpectedDuration());

        if (match.getMatchDay() != null) {
            matchDTO.setMatchDayId(match.getMatchDay().getId());
        }
        if (match.getHomeTeam() != null) {
            matchDTO.setHomeTeamId(match.getHomeTeam().getId());
            matchDTO.setHomeTeamName(match.getHomeTeam().getTeamName()); // AGGIUNTO
        }
        if (match.getAwayTeam() != null) {
            matchDTO.setAwayTeamId(match.getAwayTeam().getId());
            matchDTO.setAwayTeamName(match.getAwayTeam().getTeamName()); // AGGIUNTO
        }

        if (match.getHomeGuestGoalkeeper() != null) {
            matchDTO.setHomeGuestGoalkeeperId(match.getHomeGuestGoalkeeper().getId());
            // AGGIUNGI QUESTA RIGA:
            matchDTO.setHomeGuestGoalkeeperName(match.getHomeGuestGoalkeeper().getName() + " " + match.getHomeGuestGoalkeeper().getSurname());
        }
        if (match.getAwayGuestGoalkeeper() != null) {
            matchDTO.setAwayGuestGoalkeeperId(match.getAwayGuestGoalkeeper().getId());
            // AGGIUNGI QUESTA RIGA:
            matchDTO.setAwayGuestGoalkeeperName(match.getAwayGuestGoalkeeper().getName() + " " + match.getAwayGuestGoalkeeper().getSurname());
        }

        return matchDTO;
    }
}