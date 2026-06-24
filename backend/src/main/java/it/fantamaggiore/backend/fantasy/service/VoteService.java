package it.fantamaggiore.backend.fantasy.service;

import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.repository.MatchDayRepository;
import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.fantasy.repository.FormationRepository;
import it.fantamaggiore.backend.fantasy.repository.VoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

import java.util.ArrayList;
import java.util.List;

@Service
public class VoteService {

    @Autowired
    private MatchDayRepository matchDayRepository;

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private FormationRepository formationRepository;

    @Transactional
    public void setAllVote(long idMatchDay) {
        MatchDay matchDay = findMatchDayById(idMatchDay);

        List<Vote> votesToSave = new ArrayList<>();

        matchDay.getAvailablePlayers().forEach(player -> {
            Vote vote = new Vote(player, matchDay);
            votesToSave.add(vote);
        });

        voteRepository.saveAll(votesToSave);
    }

    @Transactional(readOnly = true)
    public MatchDay findMatchDayById(Long id) {
        return matchDayRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Match day not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<Vote> getVotesByMatchDay(Long matchDayId) {
        return voteRepository.findByMatchDayId(matchDayId);
    }

    @Transactional(readOnly = true)
    public List<Vote> getVotesByPlayer(Long playerId) {
        return voteRepository.findByPlayerId(playerId);
    }

    @Transactional
    public void deleteAllVotes(List<Vote> votes){
        voteRepository.deleteAll(votes);
    }

    @Transactional
    public Vote getVoteByMatchDayIdAndPlayerId(Long playerId, Long matchDayId){
        return voteRepository.findByPlayerIdAndMatchDayId(playerId, matchDayId)
                .orElseThrow(() -> new ResourceNotFoundException("Vote not found"));
    }

    @Transactional
    public void saveVote(Vote  vote){
        voteRepository.save(vote);
    }

    @Transactional
    public void generateBaseVotesForMatchPlayers(it.fantamaggiore.backend.tournament.model.Match match) {
        MatchDay matchDay = match.getMatchDay();
        Set<Player> playersInMatch = new HashSet<>();

        // Protezione Anti-Null per la squadra in casa
        if (match.getHomeTeam() != null && match.getHomeTeam().getPlayers() != null) {
            playersInMatch.addAll(match.getHomeTeam().getPlayers());
        }

        // Protezione Anti-Null per la squadra in trasferta
        if (match.getAwayTeam() != null && match.getAwayTeam().getPlayers() != null) {
            playersInMatch.addAll(match.getAwayTeam().getPlayers());
        }

        // Portieri in prestito
        if (match.getHomeGuestGoalkeeper() != null) {
            playersInMatch.add(match.getHomeGuestGoalkeeper());
        }
        if (match.getAwayGuestGoalkeeper() != null) {
            playersInMatch.add(match.getAwayGuestGoalkeeper());
        }

        // Generazione voti
        for (Player p : playersInMatch) {
            java.util.Optional<Vote> existingVote = voteRepository.findByPlayerIdAndMatchDayId(p.getId(), matchDay.getId());
            if (existingVote.isEmpty()) {
                Vote v = new Vote(p, matchDay);
                // 🔥 FORZIAMO LA SCRITTURA IMMEDIATA DEL VOTO
                voteRepository.saveAndFlush(v);
            }
        }
    }
}
